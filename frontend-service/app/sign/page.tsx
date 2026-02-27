'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useWallet, publicClient, parseEther, CONTRACT_ADDRESS, CHAIN_ID } from '@/app/providers'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ABI } from '@/lib/contract'

function SignContent() {
  const searchParams = useSearchParams()
  const { address, isConnected, chainId, switchChain, connectorName } = useWallet()
  const { writeContractAsync, isPending, data: hash } = useWriteContract()
  
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [txHash, setTxHash] = useState('')
  
  const action = searchParams?.get('action')
  const marketId = searchParams?.get('market_id')
  const betType = searchParams?.get('bet_type')
  const amount = searchParams?.get('amount')
  const result = searchParams?.get('result')
  const wallet = searchParams?.get('wallet')

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  useEffect(() => {
    if (isConfirmed && hash) {
      setTxHash(hash)
      setSuccess(true)
    }
  }, [isConfirmed, hash])
  
  const handleConfirm = useCallback(async () => {
    if (!isConnected || !address) {
      setError('请先连接钱包')
      return
    }
    
    if (chainId !== CHAIN_ID) {
      await switchChain()
      return
    }
    
    setError('')
    
    try {
      if (action === 'bet' && marketId && betType && amount) {
        const amountWei = parseEther(amount)
        await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'placeBet',
          args: [marketId as `0x${string}`, betType === 'yes'],
          value: amountWei,
        })
      } else if (action === 'claim' && marketId) {
        await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'claim',
          args: [marketId as `0x${string}`],
        })
      } else if (action === 'refund' && marketId) {
        await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'refundCancelledBet',
          args: [marketId as `0x${string}`],
        })
      } else if (action === 'resolve' && marketId && result) {
        const resultValue = result === 'yes' ? 1 : 2
        await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'resolveMarket',
          args: [marketId as `0x${string}`, resultValue],
        })
      } else if (action === 'cancel' && marketId) {
        await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'cancelMarket',
          args: [marketId as `0x${string}`],
        })
      } else {
        throw new Error('参数错误')
      }
    } catch (err: any) {
      console.error('Transaction error:', err)
      setError(err.message || err.shortMessage || '交易失败')
    }
  }, [isConnected, address, chainId, action, marketId, betType, amount, result, writeContractAsync, switchChain])
  
  const getActionText = () => {
    switch (action) {
      case 'bet': return '下注'
      case 'claim': return '领取奖金'
      case 'refund': return '领取退款'
      case 'resolve': return '结算议题'
      case 'cancel': return '取消议题'
      default: return '确认'
    }
  }
  
  const loading = isPending || isConfirming
  
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">交易成功！</h1>
          <p className="text-gray-600 mb-4">交易哈希: {txHash?.slice(0, 10)}...{txHash?.slice(-8)}</p>
          <button
            onClick={() => window.close()}
            className="w-full py-3 bg-primary-600 text-white rounded-lg font-medium"
          >
            关闭
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          🔐 {getActionText()}确认
        </h1>
        
        {!isConnected ? (
          <div className="text-center text-gray-600 mb-6">
            <p className="mb-4">请先连接钱包</p>
            <p className="text-sm text-gray-500 mb-4">支持 MetaMask、WalletConnect、Coinbase Wallet 等主流钱包</p>
            <button
              onClick={() => window.open('/', '_self')}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium"
            >
              连接钱包
            </button>
          </div>
        ) : (
          <>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              {action === 'bet' && (
                <>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">市场 ID</span>
                    <span className="font-medium">{marketId?.slice(0, 10)}...</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">方向</span>
                    <span className={`font-bold ${betType === 'yes' ? 'text-green-600' : 'text-red-600'}`}>
                      {betType?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">金额</span>
                    <span className="font-medium">{amount} MON</span>
                  </div>
                </>
              )}
              
              {action === 'claim' && (
                <>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">市场 ID</span>
                    <span className="font-medium">{marketId?.slice(0, 10)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">操作</span>
                    <span className="font-medium text-green-600">领取奖金</span>
                  </div>
                </>
              )}
              
              {action === 'refund' && (
                <>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">市场 ID</span>
                    <span className="font-medium">{marketId?.slice(0, 10)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">操作</span>
                    <span className="font-medium text-blue-600">领取退款</span>
                  </div>
                </>
              )}
              
              {action === 'resolve' && (
                <>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">市场 ID</span>
                    <span className="font-medium">{marketId?.slice(0, 10)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">结算结果</span>
                    <span className={`font-bold ${result === 'yes' ? 'text-green-600' : 'text-red-600'}`}>
                      {result?.toUpperCase()}
                    </span>
                  </div>
                </>
              )}
              
              {action === 'cancel' && (
                <>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">市场 ID</span>
                    <span className="font-medium">{marketId?.slice(0, 10)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">操作</span>
                    <span className="font-medium text-red-600">取消议题</span>
                  </div>
                </>
              )}
              
              <div className="border-t border-gray-200 mt-4 pt-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">钱包地址</span>
                  <span className="font-medium text-sm">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                </div>
                {connectorName && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">连接方式</span>
                    <span className="text-sm text-gray-500">{connectorName}</span>
                  </div>
                )}
              </div>
            </div>
            
            {chainId !== CHAIN_ID && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-yellow-800 text-sm">请切换到 Monad 测试网</p>
              </div>
            )}
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}
            
            <div className="flex gap-4">
              <button
                onClick={() => window.close()}
                className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 py-3 bg-primary-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? (isConfirming ? '确认中...' : '签名中...') : `确认${getActionText()}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function SignPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">加载中...</div>}>
      <SignContent />
    </Suspense>
  )
}
