'use client'

import { useWallet } from '@/app/providers'
import { useConnect } from 'wagmi'
import Link from 'next/link'
import { useState, useEffect } from 'react'

const WALLET_INFO: Record<string, { icon: string; color: string; description: string; downloadUrl?: string }> = {
  'MetaMask': { 
    icon: '🦊', 
    color: 'bg-orange-500/20 border-orange-500/30', 
    description: '最流行的浏览器钱包',
    downloadUrl: 'https://metamask.io/download/'
  },
  'io.metamask': { 
    icon: '🦊', 
    color: 'bg-orange-500/20 border-orange-500/30', 
    description: '最流行的浏览器钱包',
    downloadUrl: 'https://metamask.io/download/'
  },
  'WalletConnect': { 
    icon: '🔗', 
    color: 'bg-blue-500/20 border-blue-500/30', 
    description: '扫码连接移动钱包',
    downloadUrl: 'https://walletconnect.com/'
  },
  'walletConnect': { 
    icon: '🔗', 
    color: 'bg-blue-500/20 border-blue-500/30', 
    description: '扫码连接移动钱包',
    downloadUrl: 'https://walletconnect.com/'
  },
  'Coinbase Wallet': { 
    icon: '🔷', 
    color: 'bg-blue-600/20 border-blue-600/30', 
    description: 'Coinbase 官方钱包',
    downloadUrl: 'https://www.coinbase.com/wallet'
  },
  'coinbaseWalletSDK': { 
    icon: '🔷', 
    color: 'bg-blue-600/20 border-blue-600/30', 
    description: 'Coinbase 官方钱包',
    downloadUrl: 'https://www.coinbase.com/wallet'
  },
  'Browser Wallet': { 
    icon: '🌐', 
    color: 'bg-purple-500/20 border-purple-500/30', 
    description: '浏览器内置钱包' 
  },
  'injected': { 
    icon: '🔌', 
    color: 'bg-gray-500/20 border-gray-500/30', 
    description: '其他 Web3 钱包' 
  },
  'Trust Wallet': {
    icon: '🛡️',
    color: 'bg-blue-400/20 border-blue-400/30',
    description: '安全可靠的移动钱包',
    downloadUrl: 'https://trustwallet.com/'
  },
  'Rainbow': {
    icon: '🌈',
    color: 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-pink-500/30',
    description: '精美的以太坊钱包',
    downloadUrl: 'https://rainbow.me/'
  },
  'Rabby': {
    icon: '🐰',
    color: 'bg-purple-400/20 border-purple-400/30',
    description: '安全的浏览器钱包',
    downloadUrl: 'https://rabby.io/'
  },
  'OKX Wallet': {
    icon: '⭕',
    color: 'bg-gray-800/20 border-gray-600/30',
    description: 'OKX 交易所钱包',
    downloadUrl: 'https://www.okx.com/web3'
  },
  'TokenPocket': {
    icon: '💎',
    color: 'bg-cyan-500/20 border-cyan-500/30',
    description: '多链数字钱包',
    downloadUrl: 'https://tokenpocket.pro/'
  },
}

const WALLET_ORDER = [
  'io.metamask',
  'MetaMask', 
  'walletConnect',
  'WalletConnect',
  'coinbaseWalletSDK',
  'Coinbase Wallet',
  'injected',
  'Browser Wallet'
]

function getWalletInfo(connectorId: string, connectorName: string) {
  return WALLET_INFO[connectorId] || WALLET_INFO[connectorName] || { 
    icon: '💼', 
    color: 'bg-gray-500/20 border-gray-500/30', 
    description: 'Web3 钱包' 
  }
}

export function ConnectButton() {
  const { address, isConnected, isConnecting, chainId, connect, disconnect, switchChain, chainIdConfig, connectorName } = useWallet()
  const { connectors } = useConnect()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [connectingId, setConnectingId] = useState<string | null>(null)

  useEffect(() => {
    setHydrated(true)
  }, [])

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDropdown) {
        const target = event.target as HTMLElement
        if (!target.closest('.wallet-dropdown') && !target.closest('.wallet-modal')) {
          setShowDropdown(false)
        }
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showDropdown])

  const handleConnect = async (connectorId: string) => {
    setConnectingId(connectorId)
    try {
      await connect(connectorId)
      setShowWalletModal(false)
    } finally {
      setConnectingId(null)
    }
  }

  const sortedConnectors = [...connectors].sort((a, b) => {
    const aIndex = WALLET_ORDER.findIndex(id => a.id === id || a.name === id)
    const bIndex = WALLET_ORDER.findIndex(id => b.id === id || b.name === id)
    if (aIndex === -1 && bIndex === -1) return 0
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })

  if (!hydrated) {
    return (
      <div className="w-24 h-10 bg-gray-700/50 rounded-lg animate-pulse"></div>
    )
  }

  if (isConnecting || connectingId) {
    return (
      <button disabled className="btn-primary disabled:opacity-50 flex items-center gap-2">
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        连接中...
      </button>
    )
  }

  if (isConnected && address) {
    const walletInfo = getWalletInfo(connectorName || '', connectorName || '')
    
    return (
      <div className="relative wallet-dropdown">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-500/20 to-accent-500/20 border border-primary-500/30 hover:border-primary-500/50 transition-all"
        >
          <span className="text-lg">{walletInfo.icon}</span>
          <span className="font-mono text-sm">{formatAddress(address)}</span>
          {chainId && chainId !== chainIdConfig && (
            <span 
              onClick={(e) => { e.stopPropagation(); switchChain(); }}
              className="text-xs text-yellow-400 cursor-pointer hover:text-yellow-300"
            >
              (切换网络)
            </span>
          )}
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showDropdown && (
          <div className="absolute right-0 mt-2 w-56 rounded-xl shadow-lg border border-primary-500/20 z-50 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.98) 0%, rgba(20, 20, 35, 0.99) 100%)' }}>
            <div className="px-4 py-3 border-b border-gray-700/50">
              <div className="text-xs text-gray-500">已连接钱包</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg">{walletInfo.icon}</span>
                <span className="font-medium">{connectorName || 'Browser Wallet'}</span>
              </div>
            </div>
            <Link
              href={`/profile/${address}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-primary-500/10 transition-colors"
              onClick={() => setShowDropdown(false)}
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              我的资料
            </Link>
            <button
              onClick={() => {
                disconnect()
                setShowDropdown(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition-colors text-red-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              断开连接
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowWalletModal(true)}
        className="btn-primary flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        连接钱包
      </button>

      {showWalletModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 wallet-modal">
          <div className="card max-w-md w-full animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">选择钱包</h2>
              <button
                onClick={() => setShowWalletModal(false)}
                className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-3">
              {sortedConnectors.map((connector) => {
                const info = getWalletInfo(connector.id, connector.name)
                const isConnectingThis = connectingId === connector.id
                
                return (
                  <button
                    key={connector.id}
                    onClick={() => handleConnect(connector.id)}
                    disabled={isConnectingThis}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl ${info.color} border border-gray-700/50 hover:border-primary-500/50 transition-all disabled:opacity-50`}
                  >
                    <span className="text-3xl">{info.icon}</span>
                    <div className="text-left flex-1">
                      <div className="font-bold">{connector.name}</div>
                      <div className="text-sm text-gray-500">{info.description}</div>
                    </div>
                    {isConnectingThis && (
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
            
            <div className="mt-6 p-4 rounded-xl bg-gray-800/50 border border-gray-700/50">
              <p className="text-sm text-gray-400 text-center">
                没有钱包？{' '}
                <a 
                  href="https://metamask.io/download/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:text-primary-300 underline"
                >
                  下载 MetaMask
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
