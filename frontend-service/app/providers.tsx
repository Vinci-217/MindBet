'use client'

import { ReactNode, createContext, useContext, useState, useEffect, useCallback } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, createConfig, WagmiProvider, useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { injected, walletConnect, coinbaseWallet, metaMask } from '@wagmi/connectors'
import { createPublicClient, parseEther, formatEther } from 'viem'
import { ThemeProvider } from '@/components/ThemeProvider'

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '10143', 10)
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz'
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`

const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

const monadChain = {
  id: CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://testnet.monadexplorer.com',
    },
  },
} as const

const config = createConfig({
  chains: [monadChain],
  connectors: [
    metaMask({
      dappMetadata: {
        name: 'MindBet',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://mindbet.xyz',
      },
    }),
    walletConnect({ 
      projectId: WALLETCONNECT_PROJECT_ID,
      showQrModal: true,
      qrModalOptions: {
        themeMode: 'dark',
      },
    }),
    coinbaseWallet({
      appName: 'MindBet',
      headlessMode: false,
    }),
    injected(),
  ],
  transports: {
    [CHAIN_ID]: http(RPC_URL),
  },
  ssr: true,
})

const publicClient = createPublicClient({
  chain: monadChain,
  transport: http(RPC_URL),
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}

interface WalletContextType {
  address: `0x${string}` | null
  isConnected: boolean
  isConnecting: boolean
  chainId: number | null
  connect: (connectorId?: string) => Promise<void>
  disconnect: () => void
  switchChain: () => Promise<void>
  contractAddress: `0x${string}`
  chainIdConfig: number
  connectorName: string | undefined
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider')
  }
  return context
}

const queryClient = new QueryClient()

function WalletProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, isConnecting, chainId, connector } = useAccount()
  const { connect: wagmiConnect, connectors, isPending } = useConnect()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { switchChain: wagmiSwitchChain } = useSwitchChain()
  
  const [wasDisconnected, setWasDisconnected] = useState(false)

  useEffect(() => {
    const disconnected = sessionStorage.getItem('wallet_disconnected')
    setWasDisconnected(disconnected === 'true')
  }, [])

  const connect = useCallback(async (connectorId?: string) => {
    console.log('[Wallet] Connect called, available connectors:', connectors.map(c => ({ id: c.id, name: c.name, type: c.type })))
    
    if (wasDisconnected) {
      sessionStorage.removeItem('wallet_disconnected')
      setWasDisconnected(false)
    }
    
    let targetConnector = connectorId 
      ? connectors.find(c => c.id === connectorId || c.name === connectorId)
      : null
    
    if (!targetConnector) {
      const priority = ['io.metamask', 'metaMask', 'walletConnect', 'coinbaseWalletSDK', 'injected']
      for (const id of priority) {
        targetConnector = connectors.find(c => c.id === id || c.name === id)
        if (targetConnector) break
      }
    }
    
    if (targetConnector) {
      console.log('[Wallet] Using connector:', targetConnector.name, targetConnector.id)
      wagmiConnect({ connector: targetConnector, chainId: CHAIN_ID })
    } else if (connectors.length > 0) {
      console.log('[Wallet] Using first available connector:', connectors[0].name)
      wagmiConnect({ connector: connectors[0], chainId: CHAIN_ID })
    }
  }, [connectors, wagmiConnect, wasDisconnected])

  const disconnect = useCallback(() => {
    console.log('[Wallet] Disconnect called')
    wagmiDisconnect()
    sessionStorage.setItem('wallet_disconnected', 'true')
    setWasDisconnected(true)
  }, [wagmiDisconnect])

  const switchChain = useCallback(async () => {
    console.log('[Wallet] Switch chain called')
    wagmiSwitchChain({ chainId: CHAIN_ID })
  }, [wagmiSwitchChain])

  useEffect(() => {
    if (isConnected && address) {
      sessionStorage.removeItem('wallet_disconnected')
      setWasDisconnected(false)
    }
  }, [isConnected, address])

  const value: WalletContextType = {
    address: address || null,
    isConnected: isConnected && !wasDisconnected,
    isConnecting: isPending || isConnecting,
    chainId: chainId || null,
    connect,
    disconnect,
    switchChain,
    contractAddress: CONTRACT_ADDRESS,
    chainIdConfig: CHAIN_ID,
    connectorName: connector?.name,
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <WalletProvider>
            {children}
          </WalletProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export { CONTRACT_ADDRESS, CHAIN_ID, publicClient, parseEther, formatEther }
