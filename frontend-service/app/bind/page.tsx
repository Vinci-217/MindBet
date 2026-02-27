'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useWallet, CHAIN_ID } from '@/app/providers'
import { useSignMessage } from 'wagmi'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

function BindContent() {
  const searchParams = useSearchParams()
  const { address, isConnected, connect, disconnect, chainId, switchChain, connectorName } = useWallet()
  const { signMessageAsync } = useSignMessage()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  
  const telegramId = searchParams?.get('telegram_id')
  const username = searchParams?.get('username') || ''

  const handleBind = useCallback(async () => {
    if (!isConnected || !address) {
      setError('请先连接钱包')
      return
    }
    
    if (chainId !== CHAIN_ID) {
      await switchChain()
      return
    }
    
    if (!telegramId) {
      setError('缺少 Telegram ID')
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      const message = `绑定钱包到 Telegram ID: ${telegramId}`
      
      const signature = await signMessageAsync({ message })
      
      const response = await axios.post(`${API_URL}/api/v1/telegram/bind`, {
        telegram_id: parseInt(telegramId),
        wallet_address: address,
        signature: signature,
        username: username,
      })
      
      if (response.data.success) {
        setSuccess(true)
      } else {
        setError(response.data.error || '绑定失败')
      }
    } catch (err: any) {
      console.error('Bind error:', err)
      setError(err.response?.data?.error || err.message || '绑定失败')
    } finally {
      setLoading(false)
    }
  }, [isConnected, address, chainId, telegramId, username, signMessageAsync, switchChain])
  
  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-xl shadow-lg p-6 max-w-md w-full text-center border border-gray-700">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-white mb-2">钱包绑定成功！</h1>
          <p className="text-gray-400 mb-2">钱包地址: {address?.slice(0, 10)}...{address?.slice(-8)}</p>
          <p className="text-gray-400 mb-4">现在可以使用 Telegram Bot 进行交易了！</p>
          <button
            onClick={() => window.close()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl shadow-lg p-6 max-w-md w-full border border-gray-700">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          🔐 绑定钱包到 Telegram
        </h1>
        
        <div className="bg-gray-700 rounded-lg p-4 mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-gray-400">Telegram ID</span>
            <span className="font-medium text-white">{telegramId}</span>
          </div>
          {username && (
            <div className="flex justify-between">
              <span className="text-gray-400">用户名</span>
              <span className="font-medium text-white">@{username}</span>
            </div>
          )}
        </div>
        
        {!isConnected ? (
          <div className="text-center mb-6">
            <p className="text-gray-400 mb-4">请先连接钱包</p>
            <p className="text-gray-500 text-sm mb-4">支持 MetaMask、WalletConnect、Coinbase Wallet 等主流钱包</p>
            <button
              onClick={() => connect()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              连接钱包
            </button>
          </div>
        ) : (
          <>
            <div className="bg-gray-700 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">钱包地址</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white text-sm">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                  <button
                    onClick={disconnect}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    断开
                  </button>
                </div>
              </div>
              {connectorName && (
                <div className="flex justify-between items-center mt-2">
                  <span className="text-gray-400">连接方式</span>
                  <span className="text-sm text-gray-300">{connectorName}</span>
                </div>
              )}
            </div>
            
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-4">
              <p className="text-blue-300 text-sm">
                点击"确认绑定"后，钱包会弹出签名请求。这是免费的，不会消耗 Gas。
              </p>
            </div>
            
            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
            
            <div className="flex gap-4">
              <button
                onClick={() => window.close()}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleBind}
                disabled={loading}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {loading ? '绑定中...' : '确认绑定'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function BindPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">加载中...</div>}>
      <BindContent />
    </Suspense>
  )
}
