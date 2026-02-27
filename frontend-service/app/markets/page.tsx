'use client'

import { useState, useEffect } from 'react'
import { MarketList } from '@/components/MarketList'
import { marketApi } from '@/lib/api'
import { Market } from '@/types/market'

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<string>('')
  const [category, setCategory] = useState<string>('')

  useEffect(() => {
    fetchMarkets()
  }, [page, status, category])

  const fetchMarkets = async () => {
    setLoading(true)
    try {
      const result = await marketApi.getMarkets(page, 12)
      setMarkets(result.data?.list || [])
      setTotal(result.data?.total || 0)
    } catch (error) {
      console.error('Failed to fetch markets:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(total / 12)

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">预测市场</h1>
        <div className="flex gap-4">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input w-40"
          >
            <option value="">全部状态</option>
            <option value="0">进行中</option>
            <option value="1">已封盘</option>
            <option value="2">已结算</option>
            <option value="3">已取消</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input w-40"
          >
            <option value="">全部分类</option>
            <option value="crypto">加密货币</option>
            <option value="sports">体育</option>
            <option value="politics">政治</option>
            <option value="tech">科技</option>
            <option value="entertainment">娱乐</option>
          </select>
        </div>
      </div>

      <MarketList markets={markets} loading={loading} />

      {totalPages > 1 && (
        <div className="flex justify-center mt-8 gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="btn-secondary disabled:opacity-50"
          >
            上一页
          </button>
          <span className="px-4 py-2">
            第 {page} / {totalPages} 页
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="btn-secondary disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
