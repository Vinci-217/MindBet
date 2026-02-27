export interface Market {
  id: number
  content_hash: string
  title: string
  description: string
  category: string
  deadline: number
  creator_address: string
  group_owner_address?: string
  status: number
  result: number
  total_yes_pool: number
  total_no_pool: number
  resolved_at?: number
  created_at: string
  updated_at: string
  time_left?: number
}

export interface Transaction {
  id: number
  tx_hash: string
  content_hash: string
  user_address: string
  amount: number
  outcome?: number
  tx_type: number
  tx_status: number
  created_at: string
  market_title?: string
  market_status?: number
  market_result?: number
  market_deadline?: number
}

export interface UserProfile {
  id: number
  user_address: string
  name: string
  total_bets: number
  win_bets: number
  total_pnl: number
  total_volume: number
  created_at: string
  updated_at: string
}

export interface UserStats {
  user_address: string
  name: string
  total_bets: number
  win_bets: number
  win_rate: number
  total_pnl: number
  total_volume: number
  total_claimed: number
}

export interface MarketListResponse {
  success: boolean
  data: {
    list: Market[]
    total: number
    page: number
    page_size: number
  }
}

export interface MarketResponse {
  success: boolean
  data: Market
}

export type MarketStatus = 'open' | 'closed' | 'resolved' | 'cancelled' | 'pending'

export function getMarketStatusInfo(status: number, timeLeft?: number): { text: string; className: string; canBet: boolean } {
  if (status === 3) return { text: '已取消', className: 'status-cancelled', canBet: false }
  if (status === 2) return { text: '已结算', className: 'status-resolved', canBet: false }
  if (status === 1) return { text: '已封盘', className: 'status-closed', canBet: false }
  
  if (timeLeft !== undefined && timeLeft <= 0) {
    return { text: '待结算', className: 'status-pending', canBet: false }
  }
  
  if (timeLeft !== undefined && timeLeft <= 30 * 60) {
    return { text: '即将截止', className: 'status-closed', canBet: false }
  }
  
  return { text: '进行中', className: 'status-open', canBet: true }
}

export function getMarketResultText(result: number): string {
  switch (result) {
    case 0: return '待定'
    case 1: return 'YES'
    case 2: return 'NO'
    default: return '未知'
  }
}

export function getTransactionTypeText(txType: number): string {
  switch (txType) {
    case 1: return '创建议题'
    case 2: return '下注'
    case 3: return '领取奖励'
    case 4: return '押金退还'
    case 5: return '退款'
    default: return '其他'
  }
}
