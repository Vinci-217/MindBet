'use client'

import { MarketList } from '@/components/MarketList'
import { marketApi } from '@/lib/api'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function HomePage() {
  const [markets, setMarkets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const result = await marketApi.getMarkets(1, 6)
        setMarkets(result.data?.list || [])
      } catch (error) {
        console.error('Failed to fetch markets:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchMarkets()
  }, [])

  return (
    <div className="relative z-10">
      <section className="text-center py-16 md:py-24">
        <div className="animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/30 mb-6">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-sm text-primary-400">Powered by Monad</span>
          </div>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <span className="gradient-text">MindBet</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-400 mb-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          去中心化预测市场
        </p>
        
        <p className="text-lg text-gray-500 mb-10 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          在 <span className="text-primary-400 font-semibold">Monad</span> 链上预测未来，用 <span className="text-accent-400 font-semibold">MONAD</span> 代币表达你的观点
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <Link href="/markets" className="btn-primary text-lg px-8 py-4">
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              探索市场
            </span>
          </Link>
          <Link href="/create" className="btn-secondary text-lg px-8 py-4">
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              创建议题
            </span>
          </Link>
        </div>
      </section>

      <section className="mt-8 mb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[
            { icon: '⛓️', label: 'Monad 链', value: '10143', desc: 'Chain ID' },
            { icon: '⚡', label: '极速交易', value: '10K TPS', desc: '高性能' },
            { icon: '🔒', label: '去中心化', value: '100%', desc: '链上结算' },
            { icon: '💎', label: '低 Gas', value: '<$0.01', desc: '超低成本' },
          ].map((stat, index) => (
            <div 
              key={index}
              className="card text-center animate-fade-in-up"
              style={{ animationDelay: `${0.5 + index * 0.1}s` }}
            >
              <div className="text-3xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold gradient-text">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.label}</div>
              <div className="text-xs text-gray-500 mt-1">{stat.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">热门市场</h2>
            <p className="text-gray-500 mt-1">参与预测，赢取奖励</p>
          </div>
          <Link href="/markets" className="text-primary-400 hover:text-primary-300 transition-colors flex items-center gap-1">
            查看全部
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-gray-700/50 rounded w-1/3 mb-4"></div>
                <div className="h-6 bg-gray-700/50 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-700/50 rounded w-1/2 mb-4"></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-20 bg-gray-700/50 rounded"></div>
                  <div className="h-20 bg-gray-700/50 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <MarketList markets={markets} />
        )}
      </section>

      <section className="mt-20 mb-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">如何参与</h2>
          <p className="text-gray-500">简单三步，开启预测之旅</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              title: '连接钱包',
              desc: '使用支持 Monad 的钱包连接，推荐使用 MetaMask',
              icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                </svg>
              ),
            },
            {
              step: '02',
              title: '选择议题',
              desc: '浏览市场，选择你感兴趣的预测议题',
              icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              ),
            },
            {
              step: '03',
              title: '下注预测',
              desc: '用 MONAD 代币下注，预测正确即可获得奖励',
              icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
          ].map((item, index) => (
            <div 
              key={index}
              className="card group animate-fade-in-up"
              style={{ animationDelay: `${0.6 + index * 0.1}s` }}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary-500/10 border border-primary-500/30 flex items-center justify-center text-primary-400 group-hover:bg-primary-500/20 transition-colors">
                  {item.icon}
                </div>
                <div>
                  <div className="text-xs text-primary-500 font-mono mb-1">STEP {item.step}</div>
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-sm">{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            icon: '🎯',
            title: '预测未来',
            desc: '对任何事件进行预测，用 MONAD 代币表达你的观点',
            gradient: 'from-green-500/20 to-emerald-500/20',
            border: 'border-green-500/30',
          },
          {
            icon: '💰',
            title: '赚取收益',
            desc: '预测正确即可获得奖励，胜者通吃资金池',
            gradient: 'from-primary-500/20 to-purple-500/20',
            border: 'border-primary-500/30',
          },
          {
            icon: '🔒',
            title: '安全透明',
            desc: '基于 Monad 智能合约，所有交易链上可查',
            gradient: 'from-accent-500/20 to-blue-500/20',
            border: 'border-accent-500/30',
          },
        ].map((feature, index) => (
          <div 
            key={index}
            className={`card bg-gradient-to-br ${feature.gradient} border ${feature.border} animate-fade-in-up`}
            style={{ animationDelay: `${0.8 + index * 0.1}s` }}
          >
            <div className="text-4xl mb-4">{feature.icon}</div>
            <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
            <p className="text-gray-400">
              {feature.desc}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-20 mb-16">
        <div className="card bg-gradient-to-r from-primary-500/10 via-accent-500/10 to-primary-500/10 border border-primary-500/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold mb-2">准备好开始了吗？</h3>
              <p className="text-gray-400">创建你的第一个预测议题，或参与现有市场</p>
            </div>
            <div className="flex gap-4">
              <Link href="/create" className="btn-primary whitespace-nowrap">
                创建议题
              </Link>
              <Link href="/markets" className="btn-secondary whitespace-nowrap">
                浏览市场
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
