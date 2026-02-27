import { Market } from '@/types/market'
import Link from 'next/link'
import { useState, useEffect } from 'react'

interface MarketCardProps {
  market: Market
}

function CountdownDisplay({ seconds }: { seconds: number }) {
  if (seconds <= 0) {
    return <span className="text-red-400">已截止</span>
  }

  const days = Math.floor(seconds / (60 * 60 * 24))
  const hours = Math.floor((seconds % (60 * 60 * 24)) / (60 * 60))
  const minutes = Math.floor((seconds % (60 * 60)) / 60)
  const secs = Math.floor(seconds % 60)

  const isLast30Minutes = seconds > 0 && seconds <= 30 * 60

  let timeStr = ''
  if (days > 0) {
    timeStr = `${days}天 ${hours}小时`
  } else if (hours > 0) {
    timeStr = `${hours}小时 ${minutes}分钟`
  } else {
    timeStr = `${minutes}分钟 ${secs}秒`
  }

  return (
    <span className={isLast30Minutes ? 'text-yellow-400 font-bold countdown-urgent' : ''}>
      {timeStr}
    </span>
  )
}

export function MarketCard({ market }: MarketCardProps) {
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (!market.deadline) return
    
    const updateTimer = () => {
      const deadline = market.deadline
      const now = Math.floor(Date.now() / 1000)
      setTimeLeft(deadline - now)
    }
    
    updateTimer()
    const timer = setInterval(updateTimer, 1000)
    return () => clearInterval(timer)
  }, [market.deadline])

  const getMarketStatus = () => {
    if (market.status === 3) return { text: '已取消', className: 'status-cancelled', canBet: false }
    if (market.status === 2) return { text: '已结算', className: 'status-resolved', canBet: false }
    if (market.status === 1) return { text: '已封盘', className: 'status-closed', canBet: false }
    
    if (timeLeft <= 0) {
      return { text: '待结算', className: 'status-pending', canBet: false }
    }
    
    if (timeLeft <= 30 * 60) {
      return { text: '即将截止', className: 'status-closed countdown-urgent', canBet: false }
    }
    
    return { text: '进行中', className: 'status-open', canBet: true }
  }

  const status = getMarketStatus()

  const yesPool = Number(market.total_yes_pool) / 1e18
  const noPool = Number(market.total_no_pool) / 1e18
  const totalPool = yesPool + noPool
  const yesOdds = totalPool > 0 ? (yesPool / totalPool * 100).toFixed(1) : '50.0'
  const noOdds = totalPool > 0 ? (100 - parseFloat(yesOdds)).toFixed(1) : '50.0'

  const deadline = market.deadline > 0 ? new Date(market.deadline * 1000) : null

  return (
    <div className="card group cursor-pointer">
      <div className="card-glow"></div>
      
      <div className="relative">
        <div className="flex justify-between items-start mb-4">
          <span className={`status-badge ${status.className}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.canBet ? 'bg-green-500' : 'bg-current'}`}></span>
            {status.text}
          </span>
          <div className="text-xs text-gray-500">
            {deadline ? deadline.toLocaleDateString('zh-CN') : '未设置'}
          </div>
        </div>

        <Link href={`/markets/${market.content_hash}`}>
          <h3 className="text-lg font-bold mb-2 group-hover:text-primary-400 transition-colors line-clamp-2">
            {market.title || '未命名议题'}
          </h3>
        </Link>

        <p className="text-gray-500 text-sm mb-4 line-clamp-2">
          {market.description || '暂无描述'}
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="pool-yes rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">YES</span>
              <span className="text-xs text-green-400 font-medium">{yesOdds}%</span>
            </div>
            <div className="text-lg font-bold text-green-400">
              {yesPool.toFixed(4)}
            </div>
            <div className="text-xs text-gray-500">MONAD</div>
          </div>
          <div className="pool-no rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">NO</span>
              <span className="text-xs text-red-400 font-medium">{noOdds}%</span>
            </div>
            <div className="text-lg font-bold text-red-400">
              {noPool.toFixed(4)}
            </div>
            <div className="text-xs text-gray-500">MONAD</div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-xs text-gray-500">
            {timeLeft > 0 ? (
              <div className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <CountdownDisplay seconds={timeLeft} />
              </div>
            ) : (
              <span className="text-gray-600">
                {market.creator_address?.slice(0, 6)}...{market.creator_address?.slice(-4)}
              </span>
            )}
          </div>
          <Link
            href={`/markets/${market.content_hash}`}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-all ${
              status.canBet 
                ? 'bg-primary-500/20 text-primary-400 hover:bg-primary-500/30' 
                : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {status.canBet ? '立即下注' : '查看详情'}
          </Link>
        </div>
      </div>
    </div>
  )
}
