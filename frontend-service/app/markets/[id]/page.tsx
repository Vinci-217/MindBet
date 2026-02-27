'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useWallet, publicClient, parseEther, formatEther, CONTRACT_ADDRESS, CHAIN_ID } from '@/app/providers'
import { createWalletClient, custom } from 'viem'
import { marketApi } from '@/lib/api'
import { CONTRACT_ABI } from '@/lib/contract'
import { Market, Transaction, getMarketStatusInfo, getMarketResultText } from '@/types/market'

function CountdownTimer({ seconds }: { seconds: number }) {
  if (seconds <= 0) {
    return <span className="text-red-400 font-bold">已截止</span>
  }

  const days = Math.floor(seconds / (60 * 60 * 24))
  const hours = Math.floor((seconds % (60 * 60 * 24)) / (60 * 60))
  const minutes = Math.floor((seconds % (60 * 60)) / 60)
  const secs = Math.floor(seconds % 60)

  const isLast30Minutes = seconds > 0 && seconds <= 30 * 60

  let timeStr = ''
  if (days > 0) {
    timeStr = `${days}天 ${hours}小时 ${minutes}分钟 ${secs}秒`
  } else if (hours > 0) {
    timeStr = `${hours}小时 ${minutes}分钟 ${secs}秒`
  } else {
    timeStr = `${minutes}分钟 ${secs}秒`
  }

  return (
    <span className={isLast30Minutes ? 'text-yellow-400 font-bold countdown-urgent' : 'text-gray-400'}>
      {timeStr}
    </span>
  )
}

export default function MarketDetailPage() {
  const params = useParams()
  const contentHash = (params?.id as string) || ''
  const { address, isConnected, chainId, switchChain } = useWallet()

  const [market, setMarket] = useState<Market | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [betAmount, setBetAmount] = useState('0.001')
  const [betType, setBetType] = useState(true)
  const [showBetModal, setShowBetModal] = useState(false)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [resolveResult, setResolveResult] = useState<1 | 2>(1)
  const [mounted, setMounted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [chainMarket, setChainMarket] = useState<any>(null)
  const [userBet, setUserBet] = useState<any>(null)
  const [depositClaimed, setDepositClaimed] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!market?.deadline) return
    
    const updateTimer = () => {
      const deadline = market.deadline
      const now = Math.floor(Date.now() / 1000)
      setTimeLeft(deadline - now)
    }
    
    updateTimer()
    const timer = setInterval(updateTimer, 1000)
    return () => clearInterval(timer)
  }, [market?.deadline])

  useEffect(() => {
    fetchMarket()
  }, [contentHash])

  useEffect(() => {
    if (contentHash && address && mounted) {
      fetchChainData()
    }
  }, [contentHash, address, mounted])

  const fetchMarket = async () => {
    setLoading(true)
    try {
      const result = await marketApi.getMarket(contentHash)
      setMarket(result.data)
      
      const txResult = await marketApi.getMarketTransactions(contentHash)
      setTransactions(txResult.data?.list || [])
    } catch (error) {
      console.error('Failed to fetch market:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchChainData = async () => {
    try {
      const marketData = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getMarket',
        args: [contentHash as `0x${string}`],
      })
      setChainMarket(marketData)
      console.log('[Market] Chain market data:', marketData)

      if (address) {
        const betData = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'getUserBet',
          args: [contentHash as `0x${string}`, address],
        })
        setUserBet(betData)
        console.log('[Market] User bet data:', betData)
      }

      const claimed = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'depositClaimed',
        args: [contentHash as `0x${string}`],
      })
      setDepositClaimed(claimed as boolean)
    } catch (error) {
      console.error('Failed to fetch chain data:', error)
    }
  }

  const getWalletClient = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('请安装 MetaMask 钱包')
    }

    return createWalletClient({
      chain: {
        id: CHAIN_ID,
        name: 'Monad Testnet',
        nativeCurrency: { decimals: 18, name: 'MON', symbol: 'MON' },
        rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz'] } },
      },
      transport: custom(window.ethereum),
    })
  }, [])

  const handleBet = useCallback(async () => {
    if (!mounted || !isConnected || !address) {
      alert('请先连接钱包')
      return
    }

    if (chainId !== CHAIN_ID) {
      await switchChain()
      return
    }

    const amountWei = parseEther(betAmount)
    if (amountWei <= BigInt(0)) {
      alert('请输入有效的下注金额')
      return
    }

    setIsProcessing(true)
    try {
      const walletClient = await getWalletClient()
      
      console.log('[Bet] Placing bet:', { contentHash, betType, amount: betAmount })
      
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'placeBet',
        args: [contentHash as `0x${string}`, betType],
        value: amountWei,
        account: address,
      })

      console.log('[Bet] Transaction hash:', hash)
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      console.log('[Bet] Receipt:', receipt)

      if (receipt.status === 'success') {
        await marketApi.placeBet(contentHash, {
          tx_hash: hash,
          amount: amountWei.toString(),
          bet_type: betType,
          user_address: address,
        })
        
        setShowBetModal(false)
        fetchMarket()
        fetchChainData()
        alert('下注成功！')
      } else {
        throw new Error('交易失败')
      }
    } catch (error: any) {
      console.error('[Bet] Error:', error)
      alert('下注失败: ' + (error.message || error.toString()))
    } finally {
      setIsProcessing(false)
    }
  }, [mounted, isConnected, address, chainId, betAmount, betType, contentHash, getWalletClient])

  const handleClaim = useCallback(async () => {
    if (!mounted || !isConnected || !address) {
      alert('请先连接钱包')
      return
    }

    if (chainId !== CHAIN_ID) {
      await switchChain()
      return
    }

    setIsProcessing(true)
    try {
      const walletClient = await getWalletClient()
      
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'claim',
        args: [contentHash as `0x${string}`],
        account: address,
      })

      await publicClient.waitForTransactionReceipt({ hash })
      fetchMarket()
      fetchChainData()
      alert('领取成功！')
    } catch (error: any) {
      console.error('[Claim] Error:', error)
      alert('领取失败: ' + (error.message || error.toString()))
    } finally {
      setIsProcessing(false)
    }
  }, [mounted, isConnected, address, chainId, contentHash, getWalletClient])

  const handleRefund = useCallback(async () => {
    if (!mounted || !isConnected || !address) {
      alert('请先连接钱包')
      return
    }

    if (chainId !== CHAIN_ID) {
      await switchChain()
      return
    }

    setIsProcessing(true)
    try {
      const walletClient = await getWalletClient()
      
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'refundCancelledBet',
        args: [contentHash as `0x${string}`],
        account: address,
      })

      await publicClient.waitForTransactionReceipt({ hash })
      fetchMarket()
      fetchChainData()
      alert('退款成功！')
    } catch (error: any) {
      console.error('[Refund] Error:', error)
      alert('退款失败: ' + (error.message || error.toString()))
    } finally {
      setIsProcessing(false)
    }
  }, [mounted, isConnected, address, chainId, contentHash, getWalletClient])

  const handleCancelMarket = useCallback(async () => {
    if (!mounted || !isConnected) {
      alert('请先连接钱包')
      return
    }

    if (chainId !== CHAIN_ID) {
      await switchChain()
      return
    }

    if (!confirm('确定要取消这个议题吗？')) return

    setIsProcessing(true)
    try {
      const walletClient = await getWalletClient()
      
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'cancelMarket',
        args: [contentHash as `0x${string}`],
        account: address!,
      })

      await publicClient.waitForTransactionReceipt({ hash })
      fetchMarket()
      fetchChainData()
      alert('取消成功！')
    } catch (error: any) {
      console.error('[Cancel] Error:', error)
      alert('取消失败: ' + (error.message || error.toString()))
    } finally {
      setIsProcessing(false)
    }
  }, [mounted, isConnected, chainId, contentHash, getWalletClient])

  const handleClaimDeposit = useCallback(async () => {
    if (!mounted || !isConnected || !address) {
      alert('请先连接钱包')
      return
    }

    if (chainId !== CHAIN_ID) {
      await switchChain()
      return
    }

    setIsProcessing(true)
    try {
      const walletClient = await getWalletClient()
      
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'claimDeposit',
        args: [contentHash as `0x${string}`],
        account: address,
      })

      await publicClient.waitForTransactionReceipt({ hash })
      fetchChainData()
      alert('押金领取成功！')
    } catch (error: any) {
      console.error('[ClaimDeposit] Error:', error)
      alert('押金领取失败: ' + (error.message || error.toString()))
    } finally {
      setIsProcessing(false)
    }
  }, [mounted, isConnected, address, chainId, contentHash, getWalletClient])

  const handleResolve = useCallback(async () => {
    if (!mounted || !isConnected) {
      alert('请先连接钱包')
      return
    }

    if (chainId !== CHAIN_ID) {
      await switchChain()
      return
    }

    setIsProcessing(true)
    try {
      const walletClient = await getWalletClient()
      
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'resolveMarket',
        args: [contentHash as `0x${string}`, resolveResult],
        account: address!,
      })

      await publicClient.waitForTransactionReceipt({ hash })
      setShowResolveModal(false)
      fetchMarket()
      fetchChainData()
      alert('结算成功！')
    } catch (error: any) {
      console.error('[Resolve] Error:', error)
      alert('结算失败: ' + (error.message || error.toString()))
    } finally {
      setIsProcessing(false)
    }
  }, [mounted, isConnected, chainId, contentHash, resolveResult, getWalletClient])

  const getMarketStatus = () => {
    if (!market) return { text: '未知', className: 'status-cancelled', canBet: false }
    return getMarketStatusInfo(market.status, timeLeft)
  }

  if (!mounted || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!market) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-400">市场不存在</h2>
      </div>
    )
  }

  const status = getMarketStatus()
  const isCreator = address && chainMarket && address.toLowerCase() === (chainMarket as any)?.creator?.toLowerCase()

  const yesPoolFromChain = chainMarket ? Number((chainMarket as any).totalYesPool) : 0
  const noPoolFromChain = chainMarket ? Number((chainMarket as any).totalNoPool) : 0
  const yesPool = yesPoolFromChain || Number(market.total_yes_pool)
  const noPool = noPoolFromChain || Number(market.total_no_pool)
  
  const totalPool = yesPool + noPool
  const yesOdds = totalPool > 0 ? (yesPool / totalPool * 100).toFixed(1) : '50.0'
  const noOdds = totalPool > 0 ? (100 - parseFloat(yesOdds)).toFixed(1) : '50.0'

  const deadline = market.deadline > 0 ? new Date(market.deadline * 1000) : null

  const userBetAmount = userBet ? (userBet as any).amount : BigInt(0)
  const userBetType = userBet ? (userBet as any).betType : false
  const userBetClaimed = userBet ? (userBet as any).betClaimed : false
  const userRefundClaimed = userBet ? (userBet as any).refundClaimed : false
  const hasUserBet = userBetAmount > BigInt(0)

  const userWon = market.status === 2 && hasUserBet && (
    (market.result === 1 && userBetType) || (market.result === 2 && !userBetType)
  )
  const userLost = market.status === 2 && hasUserBet && !userWon

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card mb-8">
        <div className="flex justify-between items-start mb-6">
          <span className={`status-badge ${status.className}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.canBet ? 'bg-green-500' : 'bg-current'}`}></span>
            {status.text}
          </span>
          <div className="text-right">
            {deadline && (
              <>
                <div className="text-gray-400">
                  截止时间: {deadline.toLocaleString('zh-CN')}
                </div>
                {timeLeft > 0 && (
                  <div className="text-sm mt-1">
                    剩余: <CountdownTimer seconds={timeLeft} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-4">{market.title || '未命名议题'}</h1>
        <p className="text-gray-400 mb-6">{market.description || '暂无描述'}</p>

        <div className="mb-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
          <div className="text-sm text-gray-500 mb-1">内容哈希</div>
          <code className="text-xs text-gray-400 break-all">{market.content_hash}</code>
        </div>

        {market.status === 2 && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30">
            <div className="text-sm text-gray-400 mb-1">结算结果</div>
            <div className="text-2xl font-bold text-blue-400">
              {getMarketResultText(market.result)}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="pool-yes rounded-xl p-6">
            <div className="text-sm text-gray-400 mb-2">YES 池</div>
            <div className="text-2xl font-bold text-green-400 mb-2">
              {(yesPool / 1e18).toFixed(4)}
            </div>
            <div className="text-sm text-gray-500">{yesOdds}% 概率</div>
            <div className="text-xs text-gray-600 mt-1">MONAD</div>
          </div>
          <div className="pool-no rounded-xl p-6">
            <div className="text-sm text-gray-400 mb-2">NO 池</div>
            <div className="text-2xl font-bold text-red-400 mb-2">
              {(noPool / 1e18).toFixed(4)}
            </div>
            <div className="text-sm text-gray-500">{noOdds}% 概率</div>
            <div className="text-xs text-gray-600 mt-1">MONAD</div>
          </div>
        </div>

        {status.canBet && (
          <button
            onClick={() => setShowBetModal(true)}
            className="btn-primary w-full"
          >
            立即下注
          </button>
        )}

        {!status.canBet && market.status === 0 && timeLeft <= 30 * 60 && timeLeft > 0 && (
          <div className="text-center text-yellow-400 font-bold py-4 countdown-urgent">
            距离截止不足30分钟，无法下注
          </div>
        )}

        {!status.canBet && market.status === 0 && timeLeft <= 0 && (
          <div className="text-center text-orange-400 font-bold py-4">
            已截止，等待发起人结算结果
          </div>
        )}

        {market.status === 1 && (
          <div className="text-center text-yellow-400 font-bold py-4">
            已封盘，等待发起人结算结果
          </div>
        )}

        {market.status === 2 && hasUserBet && (
          <div className="mt-4">
            {userWon && (
              <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 text-center">
                <div className="text-green-400 font-bold text-lg mb-2">🎉 恭喜！你预测正确！</div>
                {userBetClaimed ? (
                  <div className="text-green-400">✓ 已领取奖励</div>
                ) : (
                  <button 
                    onClick={handleClaim} 
                    disabled={isProcessing}
                    className="btn-success w-full disabled:opacity-50"
                  >
                    {isProcessing ? '处理中...' : '领取奖励'}
                  </button>
                )}
              </div>
            )}
            {userLost && (
              <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 text-center">
                <div className="text-red-400 font-bold text-lg">😢 可惜，你预测错误</div>
                <div className="text-gray-500 text-sm mt-1">下注金额: {formatEther(userBetAmount)} MONAD</div>
              </div>
            )}
          </div>
        )}

        {market.status === 3 && hasUserBet && (
          <div className="mt-4">
            <div className="mb-4 p-4 rounded-xl bg-gray-800/50 border border-gray-700/50 text-center">
              <div className="text-gray-400 font-bold mb-2">议题已取消</div>
              {userRefundClaimed ? (
                <div className="text-green-400">✓ 已领取退款</div>
              ) : (
                <button 
                  onClick={handleRefund} 
                  disabled={isProcessing}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {isProcessing ? '处理中...' : '领取退款'}
                </button>
              )}
            </div>
          </div>
        )}

        {hasUserBet && (
          <div className="mt-6 p-4 rounded-xl bg-gray-800/50 border border-gray-700/50">
            <h3 className="font-bold mb-3">我的下注</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">金额</div>
                <div className="font-bold">{formatEther(userBetAmount)} MONAD</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">方向</div>
                <div className={`font-bold ${userBetType ? 'text-green-400' : 'text-red-400'}`}>
                  {userBetType ? 'YES' : 'NO'}
                </div>
              </div>
            </div>
            {market.status === 2 && (
              <div className={`mt-3 font-bold ${userWon ? 'text-green-400' : 'text-red-400'}`}>
                {userWon ? '✓ 预测正确' : '✗ 预测错误'}
              </div>
            )}
          </div>
        )}

        {isCreator && market.status !== 2 && market.status !== 3 && (
          <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30">
            <h3 className="font-bold mb-4 text-purple-400">发起人操作</h3>
            
            {market.status === 0 && timeLeft > 0 && (
              <button 
                onClick={handleCancelMarket} 
                disabled={isProcessing}
                className="btn-danger w-full mb-3 disabled:opacity-50"
              >
                {isProcessing ? '处理中...' : '取消议题'}
              </button>
            )}

            {(market.status === 0 || market.status === 1) && timeLeft <= 0 && (
              <button 
                onClick={() => setShowResolveModal(true)} 
                disabled={isProcessing}
                className="btn-primary w-full mb-3 disabled:opacity-50"
              >
                {isProcessing ? '处理中...' : '结算结果'}
              </button>
            )}

            {(market.status === 2 || market.status === 3) && !depositClaimed && (
              <button 
                onClick={handleClaimDeposit} 
                disabled={isProcessing}
                className="btn-success w-full disabled:opacity-50"
              >
                {isProcessing ? '处理中...' : '领取押金 (0.001 MONAD)'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-xl font-bold mb-4">交易记录</h2>
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="text-center text-gray-500 py-4">暂无交易记录</div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="flex justify-between items-center p-4 rounded-xl bg-gray-800/50 border border-gray-700/50">
                <div>
                  <span className="font-medium">{tx.user_address.slice(0, 8)}...{tx.user_address.slice(-6)}</span>
                  <span className="ml-2 text-gray-500">
                    {tx.tx_type === 2 ? (tx.outcome === 1 ? 'YES' : 'NO') : tx.tx_type === 1 ? '创建' : tx.tx_type === 3 ? '领取' : '其他'}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-bold">{(Number(tx.amount) / 1e18).toFixed(4)} MONAD</div>
                  <div className="text-sm text-gray-500">
                    {new Date(tx.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showBetModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full animate-scale-in">
            <h2 className="text-xl font-bold mb-6">下注</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-3 text-gray-400">选择方向</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setBetType(true)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    betType ? 'border-green-500 bg-green-500/10 scale-105' : 'border-gray-700 hover:border-green-500/50'
                  }`}
                >
                  <div className="text-lg font-bold text-green-400">YES</div>
                  <div className="text-sm text-gray-500">{yesOdds}%</div>
                </button>
                <button
                  onClick={() => setBetType(false)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    !betType ? 'border-red-500 bg-red-500/10 scale-105' : 'border-gray-700 hover:border-red-500/50'
                  }`}
                >
                  <div className="text-lg font-bold text-red-400">NO</div>
                  <div className="text-sm text-gray-500">{noOdds}%</div>
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-3 text-gray-400">下注金额 (MONAD)</label>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="input"
                min="0.0001"
                step="0.0001"
                placeholder="输入金额"
              />
              <div className="flex gap-2 mt-3">
                {['0.001', '0.01', '0.1'].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setBetAmount(amount)}
                    className={`flex-1 py-2 text-sm rounded-lg transition-all ${
                      betAmount === amount ? 'bg-primary-500 text-white' : 'bg-gray-700/50 hover:bg-gray-700 text-gray-400'
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowBetModal(false)}
                className="btn-secondary flex-1"
              >
                取消
              </button>
              <button
                onClick={handleBet}
                disabled={isProcessing}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {isProcessing ? '处理中...' : '确认下注'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showResolveModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full animate-scale-in">
            <h2 className="text-xl font-bold mb-4">结算结果</h2>
            <p className="text-gray-400 mb-6">请选择议题的结果：</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => setResolveResult(1)}
                className={`p-6 rounded-xl border-2 transition-all ${
                  resolveResult === 1 ? 'border-green-500 bg-green-500/10 scale-105' : 'border-gray-700 hover:border-green-500/50'
                }`}
              >
                <div className="text-2xl font-bold text-green-400">YES</div>
                <div className="text-sm text-gray-500">是</div>
              </button>
              <button
                onClick={() => setResolveResult(2)}
                className={`p-6 rounded-xl border-2 transition-all ${
                  resolveResult === 2 ? 'border-red-500 bg-red-500/10 scale-105' : 'border-gray-700 hover:border-red-500/50'
                }`}
              >
                <div className="text-2xl font-bold text-red-400">NO</div>
                <div className="text-sm text-gray-500">否</div>
              </button>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowResolveModal(false)}
                className="btn-secondary flex-1"
              >
                取消
              </button>
              <button
                onClick={handleResolve}
                disabled={isProcessing}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {isProcessing ? '处理中...' : '确认结算'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
