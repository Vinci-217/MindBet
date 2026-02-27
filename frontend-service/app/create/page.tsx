'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet, publicClient, parseEther, formatEther, CONTRACT_ADDRESS, CHAIN_ID } from '@/app/providers'
import { createWalletClient, custom } from 'viem'
import { CREATOR_DEPOSIT, CONTRACT_ABI } from '@/lib/contract'
import sha256 from 'crypto-js/sha256'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

function getChinaDateTimeString(minutesLater: number = 0): string {
  const date = new Date()
  date.setMinutes(date.getMinutes() + minutesLater)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export default function CreateMarketPage() {
  const router = useRouter()
  const { address, isConnected, chainId, switchChain } = useWallet()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('crypto')
  const [deadline, setDeadline] = useState('')
  const [mounted, setMounted] = useState(false)
  const [checking, setChecking] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    setMounted(true)
    const minTime = getChinaDateTimeString(40)
    setDeadline(minTime)
  }, [])

  const computeHash = (content: string): `0x${string}` => {
    const hash = sha256(content)
    return ('0x' + hash.toString()) as `0x${string}`
  }

  const deadlineTimestamp = deadline ? Math.floor(new Date(deadline).getTime() / 1000) : 0
  
  const content = JSON.stringify({
    title,
    description,
    category,
    deadline: deadlineTimestamp,
  })
  
  const contentHash = computeHash(content)
  const groupOwnerAddress = '0x0000000000000000000000000000000000000000' as `0x${string}`

  const checkContentHashExists = async (hash: string): Promise<boolean> => {
    try {
      const response = await axios.get(`${API_URL}/api/v1/markets/check/${hash}`)
      return response.data?.data?.exists || false
    } catch (error) {
      console.error('Failed to check content hash:', error)
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!mounted) return

    if (!isConnected || !address) {
      alert('请先连接钱包')
      return
    }

    if (chainId !== CHAIN_ID) {
      await switchChain()
      return
    }

    if (!title || !deadline) {
      alert('请填写完整信息')
      return
    }

    const deadlineDate = new Date(deadline)
    const now = new Date()
    const minDeadline = new Date(now.getTime() + 40 * 60 * 1000)

    if (deadlineDate <= minDeadline) {
      alert('截止时间必须距离当前时间至少40分钟')
      return
    }

    setChecking(true)
    const exists = await checkContentHashExists(contentHash)
    setChecking(false)

    if (exists) {
      alert('该议题已存在，无法重复创建！\n请修改标题、描述或截止时间后重试。')
      return
    }

    setIsCreating(true)
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('请安装 MetaMask 钱包')
      }

      const walletClient = createWalletClient({
        chain: {
          id: CHAIN_ID,
          name: 'Monad Testnet',
          nativeCurrency: { decimals: 18, name: 'MON', symbol: 'MON' },
          rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz'] } },
        },
        transport: custom(window.ethereum),
      })

      console.log('[CreateMarket] Creating market with hash:', contentHash)
      
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'createMarket',
        args: [contentHash, BigInt(deadlineTimestamp), groupOwnerAddress],
        value: CREATOR_DEPOSIT,
        account: address,
      })

      console.log('[CreateMarket] Transaction hash:', hash)
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      console.log('[CreateMarket] Receipt:', receipt)

      if (receipt.status === 'success') {
        const response = await axios.post(`${API_URL}/api/v1/markets`, {
          title,
          description,
          category,
          deadline: deadlineTimestamp,
          creator_address: address,
          content_hash: contentHash,
        })
        
        console.log('[CreateMarket] Save market response:', response.data)
        alert('创建成功！')
        router.push('/markets')
      } else {
        throw new Error('交易失败')
      }
    } catch (error: any) {
      console.error('[CreateMarket] Error:', error)
      alert('创建失败: ' + (error.message || error.toString()))
    } finally {
      setIsCreating(false)
    }
  }

  if (!mounted) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700/50 rounded w-1/3 mb-8"></div>
          <div className="card">
            <div className="h-12 bg-gray-700/50 rounded mb-6"></div>
            <div className="h-24 bg-gray-700/50 rounded mb-6"></div>
            <div className="h-12 bg-gray-700/50 rounded mb-6"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">创建预测议题</h1>
        <p className="text-gray-500">在 Monad 链上创建一个去中心化的预测市场</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3 text-gray-400">
              议题标题 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="例如: 比特币在2024年底会突破10万美元吗？"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-3 text-gray-400">详细描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input min-h-[120px] resize-none"
              placeholder="详细描述这个预测议题..."
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-3 text-gray-400">分类</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input"
            >
              <option value="crypto">加密货币</option>
              <option value="sports">体育</option>
              <option value="politics">政治</option>
              <option value="tech">科技</option>
              <option value="entertainment">娱乐</option>
              <option value="other">其他</option>
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-3 text-gray-400">
              截止时间 (北京时间) <span className="text-red-400">*</span>
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="input"
              min={getChinaDateTimeString(40)}
              required
            />
            <p className="text-sm text-gray-500 mt-2">
              截止时间必须距离当前时间至少40分钟
            </p>
          </div>
        </div>

        <div className="card bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-yellow-400 mb-2">创建押金</h3>
              <div className="text-2xl font-bold text-yellow-300 mb-2">
                {formatEther(CREATOR_DEPOSIT)} MONAD
              </div>
              <p className="text-sm text-gray-300">
                创建议题需要抵押 <strong className="text-yellow-300">{formatEther(CREATOR_DEPOSIT)} MONAD</strong> 作为押金。
                如果有人下注，押金将在议题结算后退还给创建者。
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-gray-800/30 border border-gray-700/50">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold mb-2">内容哈希</h3>
              <code className="text-xs text-gray-400 break-all block mb-2">{contentHash}</code>
              <p className="text-xs text-gray-500">
                此哈希由标题、描述、分类和截止时间共同生成，用于唯一标识议题。
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isCreating || checking || !isConnected}
          className="btn-primary w-full py-4 text-lg disabled:opacity-50"
        >
          {checking ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              检查中...
            </span>
          ) : isCreating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              创建中...
            </span>
          ) : (
            '创建议题'
          )}
        </button>
        
        {!isConnected && (
          <p className="text-center text-red-400">请先连接钱包</p>
        )}
        {isConnected && chainId !== CHAIN_ID && (
          <p className="text-center text-yellow-400">请切换到 Monad 测试网</p>
        )}
      </form>
    </div>
  )
}
