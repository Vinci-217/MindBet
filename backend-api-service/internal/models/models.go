package models

import (
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

type MarketStatus int8

const (
	MarketStatusOpen      MarketStatus = 0
	MarketStatusClosed    MarketStatus = 1
	MarketStatusResolved  MarketStatus = 2
	MarketStatusCancelled MarketStatus = 3
)

type MarketResult int8

const (
	MarketResultEmpty MarketResult = 0
	MarketResultYes   MarketResult = 1
	MarketResultNo    MarketResult = 2
)

type Market struct {
	ID             uint64       `gorm:"primaryKey;autoIncrement" json:"id"`
	ContentHash    string       `gorm:"size:66;uniqueIndex;not null" json:"content_hash"`
	Title          string       `gorm:"size:255;not null" json:"title"`
	Description    string       `gorm:"type:text" json:"description"`
	Category       string       `gorm:"size:50" json:"category"`
	Deadline       int64        `gorm:"not null" json:"deadline"`
	CreatorAddress string       `gorm:"size:42;not null;index" json:"creator_address"`
	GroupOwnerAddr string       `gorm:"size:42" json:"group_owner_address"`
	Status         MarketStatus `gorm:"type:tinyint;not null;default:0;index" json:"status"`
	Result         MarketResult `gorm:"type:tinyint;default:0" json:"result"`
	TotalYesPool   uint64       `gorm:"not null;default:0" json:"total_yes_pool"`
	TotalNoPool    uint64       `gorm:"not null;default:0" json:"total_no_pool"`
	ResolvedAt     *int64       `gorm:"default:null" json:"resolved_at"`
	CreatedAt      time.Time    `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt      time.Time    `gorm:"autoUpdateTime" json:"updated_at"`
}

func (Market) TableName() string {
	return "markets"
}

type TransactionType int8

const (
	TxTypeCreateMarket  TransactionType = 1
	TxTypeBet           TransactionType = 2
	TxTypeClaim         TransactionType = 3
	TxTypeDepositRefund TransactionType = 4
	TxTypeRefund        TransactionType = 5
	TxTypeResolveMarket TransactionType = 6
	TxTypeCancelMarket  TransactionType = 7
)

type TransactionStatus int8

const (
	TxStatusFailed  TransactionStatus = 0
	TxStatusSuccess TransactionStatus = 1
)

type Transaction struct {
	ID           uint64            `gorm:"primaryKey;autoIncrement" json:"id"`
	TxHash       string            `gorm:"size:66;uniqueIndex;not null" json:"tx_hash"`
	ContentHash  string            `gorm:"size:66;index" json:"content_hash"`
	UserAddress  string            `gorm:"size:42;not null;index" json:"user_address"`
	Amount       uint64            `gorm:"not null" json:"amount"`
	Outcome      *int8             `gorm:"type:tinyint" json:"outcome"`
	TxType       TransactionType   `gorm:"type:tinyint;not null" json:"tx_type"`
	TxStatus     TransactionStatus `gorm:"type:tinyint;not null;default:1" json:"tx_status"`
	CreatedAt    time.Time         `gorm:"autoCreateTime" json:"created_at"`
}

func (Transaction) TableName() string {
	return "transactions"
}

type PositionRole int8

const (
	PositionRoleCreator PositionRole = 1
	PositionRoleBettor  PositionRole = 2
)

type UserPosition struct {
	ID             uint64        `gorm:"primaryKey;autoIncrement" json:"id"`
	UserAddress    string        `gorm:"size:42;not null;uniqueIndex:idx_user_market_role" json:"user_address"`
	ContentHash    string        `gorm:"size:66;not null;uniqueIndex:idx_user_market_role" json:"content_hash"`
	Role           PositionRole  `gorm:"type:tinyint;not null;uniqueIndex:idx_user_market_role" json:"role"`
	BetOutcome     *int8         `gorm:"type:tinyint" json:"bet_outcome"`
	BetAmount      uint64        `gorm:"not null;default:0" json:"bet_amount"`
	DepositAmount  uint64        `gorm:"not null;default:0" json:"deposit_amount"`
	HasClaimed     bool          `gorm:"not null;default:false" json:"has_claimed"`
	HasRefunded    bool          `gorm:"not null;default:false" json:"has_refunded"`
	ClaimedAt      *time.Time    `json:"claimed_at"`
	CreatedAt      time.Time     `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt      time.Time     `gorm:"autoUpdateTime" json:"updated_at"`
}

func (UserPosition) TableName() string {
	return "user_positions"
}

type UserProfile struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserAddress string    `gorm:"size:42;uniqueIndex;not null" json:"user_address"`
	Name        string    `gorm:"size:100;default:普通用户" json:"name"`
	TotalBets   uint64    `gorm:"not null;default:0" json:"total_bets"`
	WinBets     uint64    `gorm:"not null;default:0" json:"win_bets"`
	TotalPnL    int64     `gorm:"not null;default:0" json:"total_pnl"`
	TotalVolume uint64    `gorm:"not null;default:0" json:"total_volume"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (UserProfile) TableName() string {
	return "user_profiles"
}

type Group struct {
	ID              uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Platform        string    `gorm:"size:20;not null;uniqueIndex:platform_group" json:"platform"`
	PlatformGroupID string    `gorm:"size:100;not null;uniqueIndex:platform_group" json:"platform_group_id"`
	GroupName       string    `gorm:"size:255" json:"group_name"`
	OwnerAddress    string    `gorm:"size:42" json:"owner_address"`
	IsEnabled       bool      `gorm:"default:true" json:"is_enabled"`
	MemberCount     int       `gorm:"default:0" json:"member_count"`
	CreatedAt       time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (Group) TableName() string {
	return "groups"
}

type TelegramUser struct {
	ID            uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	TelegramID    int64     `gorm:"not null;uniqueIndex;not null" json:"telegram_id"`
	WalletAddress string    `gorm:"size:42;not null;index" json:"wallet_address"`
	Username      string    `gorm:"size:255" json:"username"`
	Signature     string    `gorm:"size:255" json:"signature"`
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (TelegramUser) TableName() string {
	return "telegram_users"
}

type Discussion struct {
	ID              uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Platform        string    `gorm:"size:20;not null;index:platform_group_created" json:"platform"`
	PlatformGroupID string    `gorm:"size:100;not null;index:platform_group_created" json:"platform_group_id"`
	PlatformUserID  string    `gorm:"size:100" json:"platform_user_id"`
	MessageID       string    `gorm:"size:100" json:"message_id"`
	MessageText     string    `gorm:"type:text" json:"message_text"`
	CreatedAt       time.Time `gorm:"autoCreateTime;index:platform_group_created" json:"created_at"`
}

func (Discussion) TableName() string {
	return "discussions"
}

var DB *gorm.DB

func InitDB(dsn string) error {
	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return err
	}

	return DB.AutoMigrate(
		&Market{},
		&Transaction{},
		&UserProfile{},
		&Group{},
		&Discussion{},
		&TelegramUser{},
		&UserPosition{},
	)
}
