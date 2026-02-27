'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { userApi } from '@/lib/api'
import { UserProfile, Transaction, Market, getMarketStatusInfo, getMarketResultText } from '@/types/market'

function StatCard({ label, value, suffix, color }: { label: string; value: string | number; suffix?: string; color?: string }) {
  return (
    <div className="card text-center">
      <div className={`text-2xl md:text-3xl font-bold ${color || 'text-white'}`}>
        {value}{suffix && <span className="text-sm ml-1">{suffix}</span>}
      </div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  )
}

function MarketStatusBadge({ status, timeLeft }: { status: number; timeLeft?: number }) {
  const info = getMarketStatusInfo(status, timeLeft)
  return (
    <span className={`status-badge ${info.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${info.canBet ? 'bg-green-500' : 'bg-current'}`}></span>
      {info.text}
    </span>
  )
}

function MarketItem({ market }: { market: Market }) {
  const yesPool = Number(market.total_yes_pool) / 1e18
  const noPool = Number(market.total_no_pool) / 1e18
  const totalPool = yesPool + noPool
  const yesOdds = totalPool > 0 ? (yesPool / totalPool * 100).toFixed(1) : '50.0'
  const noOdds = totalPool > 0 ? (100 - parseFloat(yesOdds)).toFixed(1) : '50.0'

  return (
    <Link href={`/markets/${market.content_hash}`}>
      <div className="card group hover:border-primary-500/40 transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <MarketStatusBadge status={market.status} timeLeft={market.time_left} />
              {market.status === 2 && (
                <span className={`text-sm font-medium ${market.result === 1 ? 'text-green-400' : 'text-red-400'}`}>
                  结果: {getMarketResultText(market.result)}
                </span>
              )}
            </div>
            <h3 className="font-bold text-lg group-hover:text-primary-400 transition-colors truncate">
              {market.title || '未命名议题'}
            </h3>
            <p className="text-sm text-gray-500 mt-1 line-clamp-1">
              {market.description || '暂无描述'}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="pool-yes rounded-lg px-3 py-2 text-center">
                <div className="text-xs text-gray-400">YES</div>
                <div className="text-sm font-bold text-green-400">{yesOdds}%</div>
              </div>
              <div className="pool-no rounded-lg px-3 py-2 text-center">
                <div className="text-xs text-gray-400">NO</div>
                <div className="text-sm font-bold text-red-400">{noOdds}%</div>
              </div>
            </div>
            
            <svg className="w-5 h-5 text-gray-500 group-hover:text-primary-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  )
}

function BetItem({ bet }: { bet: Transaction }) {
  const amount = Number(bet.amount) / 1e18
  const isWin = bet.market_status === 2 && (
    (bet.market_result === 1 && bet.outcome === 1) || 
    (bet.market_result === 2 && bet.outcome === 2)
  )
  const isLose = bet.market_status === 2 && !isWin

  return (
    <Link href={`/markets/${bet.content_hash}`}>
      <div className="card group hover:border-primary-500/40 transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className={`status-badge ${bet.outcome === 1 ? 'status-open' : 'status-cancelled'}`}>
                {bet.outcome === 1 ? 'YES' : 'NO'}
              </span>
              {bet.market_status !== undefined && (
                <MarketStatusBadge status={bet.market_status} />
              )}
              {isWin && (
                <span className="text-sm text-green-400 font-medium">✓ 预测正确</span>
              )}
              {isLose && (
                <span className="text-sm text-red-400 font-medium">✗ 预测错误</span>
              )}
            </div>
            <h3 className="font-bold group-hover:text-primary-400 transition-colors truncate">
              {bet.market_title || '未知议题'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(bet.created_at).toLocaleString('zh-CN')}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg font-bold">{amount.toFixed(4)}</div>
              <div className="text-xs text-gray-500">MONAD</div>
            </div>
            
            <svg className="w-5 h-5 text-gray-500 group-hover:text-primary-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  )
}

function ClaimItem({ claim }: { claim: Transaction }) {
  const amount = Number(claim.amount) / 1e18

  return (
    <Link href={`/markets/${claim.content_hash}`}>
      <div className="card group hover:border-primary-500/40 transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="status-badge status-resolved">
                领取奖励
              </span>
            </div>
            <h3 className="font-bold group-hover:text-primary-400 transition-colors truncate">
              {claim.market_title || '未知议题'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(claim.created_at).toLocaleString('zh-CN')}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg font-bold text-green-400">+{amount.toFixed(4)}</div>
              <div className="text-xs text-gray-500">MONAD</div>
            </div>
            
            <svg className="w-5 h-5 text-gray-500 group-hover:text-primary-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function ProfilePage() {
  const params = useParams()
  const address = (params?.address as string) || ''

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<{ win_rate: number; total_pnl: number; name: string } | null>(null)
  const [createdMarkets, setCreatedMarkets] = useState<Market[]>([])
  const [bets, setBets] = useState<Transaction[]>([])
  const [claims, setClaims] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'created' | 'bets' | 'claims'>('created')
  const [showNameModal, setShowNameModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [address])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const [profileResult, betsResult, marketsResult, claimsResult, statsResult] = await Promise.all([
        userApi.getProfile(address),
        userApi.getBets(address),
        userApi.getCreatedMarkets(address),
        userApi.getClaims(address),
        userApi.getStats(address),
      ])
      
      setProfile(profileResult.data)
      setBets(betsResult.data?.list || [])
      setCreatedMarkets(marketsResult.data?.list || [])
      setClaims(claimsResult.data?.list || [])
      setStats(statsResult.data)
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      alert('请输入用户名')
      return
    }
    
    setSaving(true)
    try {
      await userApi.updateProfile(address, { name: newName.trim() })
      setProfile(prev => prev ? { ...prev, name: newName.trim() } : null)
      setStats(prev => prev ? { ...prev, name: newName.trim() } : null)
      setShowNameModal(false)
      alert('用户名修改成功！')
    } catch (error) {
      console.error('Failed to update name:', error)
      alert('修改失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="animate-pulse">
          <div className="card mb-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-20 h-20 rounded-full bg-gray-700"></div>
              <div className="flex-1">
                <div className="h-6 bg-gray-700 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-2/3"></div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gray-700/50 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const winRate = stats?.win_rate || (profile && profile.total_bets > 0
    ? (profile.win_bets / profile.total_bets * 100)
    : 0)
  const pnl = stats?.total_pnl || (profile ? Number(profile.total_pnl) / 1e18 : 0)
  const displayName = stats?.name || profile?.name || '普通用户'

  return (
    <div className="max-w-5xl mx-auto">
      <div className="card mb-8">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-3xl font-bold text-white">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
              <h1 className="text-2xl font-bold">{displayName}</h1>
              <button 
                onClick={() => {
                  setNewName(displayName)
                  setShowNameModal(true)
                }}
                className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                title="修改用户名"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
            <p className="text-gray-500 font-mono text-sm break-all">
              {address}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            label="总下注" 
            value={profile?.total_bets || 0} 
            suffix="次"
          />
          <StatCard 
            label="获胜次数" 
            value={profile?.win_bets || 0} 
            suffix="次"
            color="text-green-400"
          />
          <StatCard 
            label="胜率" 
            value={winRate.toFixed(1)} 
            suffix="%"
            color={winRate >= 50 ? 'text-green-400' : 'text-red-400'}
          />
          <StatCard 
            label="盈亏" 
            value={`${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)}`}
            suffix="MONAD"
            color={pnl >= 0 ? 'text-green-400' : 'text-red-400'}
          />
        </div>
      </div>

      <div className="card">
        <div className="flex border-b border-gray-700/50 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('created')}
            className={`tab-button whitespace-nowrap ${activeTab === 'created' ? 'active' : ''}`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              创建的议题
              {createdMarkets.length > 0 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-primary-500/20 text-primary-400">
                  {createdMarkets.length}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('bets')}
            className={`tab-button whitespace-nowrap ${activeTab === 'bets' ? 'active' : ''}`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              下注记录
              {bets.length > 0 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-primary-500/20 text-primary-400">
                  {bets.length}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('claims')}
            className={`tab-button whitespace-nowrap ${activeTab === 'claims' ? 'active' : ''}`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              领取记录
              {claims.length > 0 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-primary-500/20 text-primary-400">
                  {claims.length}
                </span>
              )}
            </span>
          </button>
        </div>

        <div className="space-y-4">
          {activeTab === 'created' && (
            <>
              {createdMarkets.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <p className="text-gray-500 mb-4">还没有创建任何议题</p>
                  <Link href="/create" className="btn-primary inline-flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    创建第一个议题
                  </Link>
                </div>
              ) : (
                createdMarkets.map((market) => (
                  <MarketItem key={market.id} market={market} />
                ))
              )}
            </>
          )}

          {activeTab === 'bets' && (
            <>
              {bets.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 mb-4">还没有参与任何下注</p>
                  <Link href="/markets" className="btn-primary inline-flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    探索市场
                  </Link>
                </div>
              ) : (
                bets.map((bet) => (
                  <BetItem key={bet.id} bet={bet} />
                ))
              )}
            </>
          )}

          {activeTab === 'claims' && (
            <>
              {claims.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 mb-4">还没有领取记录</p>
                  <Link href="/markets" className="btn-primary inline-flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    探索市场
                  </Link>
                </div>
              ) : (
                claims.map((claim) => (
                  <ClaimItem key={claim.id} claim={claim} />
                ))
              )}
            </>
          )}
        </div>
      </div>

      {showNameModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full animate-scale-in">
            <h2 className="text-xl font-bold mb-6">修改用户名</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-3 text-gray-400">用户名</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="input"
                placeholder="输入新用户名"
                maxLength={20}
              />
              <p className="text-xs text-gray-500 mt-2">最多20个字符</p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowNameModal(false)}
                className="btn-secondary flex-1"
              >
                取消
              </button>
              <button
                onClick={handleUpdateName}
                disabled={saving || !newName.trim()}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
