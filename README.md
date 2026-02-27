# Manifold Markets Telegram Bot

A Telegram bot for interacting with [Manifold Markets](https://manifold.markets) prediction market, with AI-powered analysis capabilities.

## Features

- 🔍 **Search Markets** - Search and browse prediction markets on Manifold
- 💰 **Place Bets** - Bet YES/NO on any market with M$ (Mana dollars)
- 📊 **View Results** - Check market resolution status and outcomes
- 💳 **Wallet Management** - View balance and portfolio
- 🤖 **AI Analysis** - AI-powered market analysis using Tencent Hunyuan or other compatible APIs
- 💾 **User Memory** - AI remembers conversation history
- 🖥️ **Background Running** - Run as a daemon process

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Start using the bot |
| `/help` | Show help information |
| `/markets [keyword]` | Search markets by keyword |
| `/market <id>` | View market details |
| `/bet <id> <YES/NO> <amount>` | Place a bet (amount in M$) |
| `/sell <id> <YES/NO> [shares]` | Sell shares |
| `/result <id>` | Check market result |
| `/wallet` | View wallet balance |
| `/portfolio` | View investment portfolio |
| `/setkey <api_key>` | Set your Manifold API Key |
| `/history` | View betting history |
| `/ai <question>` | Chat with AI assistant |
| `/analyze <id>` | AI-powered market analysis |

## Technical Architecture

### Technology Stack

- **Language**: Python 3.9+
- **Telegram Bot API**: python-telegram-bot v21.0
- **AI Integration**: Tencent Hunyuan API (compatible with OpenAI format)
- **Database**: SQLite (aiosqlite)
- **HTTP Client**: aiohttp
- **Proxy**: Mihomo/Clash

### Project Structure

```
manifold-telegram-bot/
├── bot/
│   ├── handlers/              # Command handlers
│   │   ├── start.py          # /start, /help commands
│   │   ├── markets.py        # /markets, /market commands
│   │   ├── bet.py            # /bet, /sell commands
│   │   ├── result.py         # /result command
│   │   ├── wallet.py          # /wallet, /portfolio commands
│   │   └── ai_chat.py        # /ai, /analyze, /setkey commands
│   ├── utils/
│   │   ├── manifold_api.py  # Manifold Markets API client
│   │   ├── ai_client.py      # AI API client (Hunyuan/GLM compatible)
│   │   └── storage.py        # SQLite database operations
│   ├── config.py             # Configuration (environment variables)
│   └── main.py               # Bot entry point
├── proxy/                    # Mihomo proxy configuration
│   ├── mihomo               # Proxy binary
│   └── config.yaml          # Proxy configuration
├── data/                    # SQLite database storage
├── logs/                    # Log files
├── start.sh                 # Startup script (daemon management)
├── .env                     # Environment variables (sensitive)
├── .env.example             # Environment template
├── requirements.txt         # Python dependencies
└── README.md                # This file
```

### Core Modules

#### bot/main.py
Bot entry point, initializes Telegram application and registers all command handlers.

#### bot/config.py
Configuration management, reads from environment variables:
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `TELEGRAM_PROXY` - Proxy URL (required for China servers)
- `MANIFOLD_API_BASE` - Manifold API endpoint
- `AI_API_URL` - AI API endpoint (supports OpenAI-compatible APIs)
- `AI_API_KEY` - AI API key
- `AI_MODEL` - AI model name

#### bot/utils/manifold_api.py
Manifold Markets API client with methods for:
- Market search and browsing
- Bet placement and selling
- User portfolio queries
- Bet history retrieval

#### bot/utils/ai_client.py
AI client supporting OpenAI-compatible APIs:
- Tencent Hunyuan (hunyuan-turbos-latest)
- Zhipu GLM (glm-4 etc.)
- Custom OpenAI-compatible endpoints

## Installation

### Prerequisites

- Python 3.9+
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Manifold Markets API Key (optional, for betting)
- AI API Key (optional, for AI features)

### Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd manifold-telegram-bot
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Run the bot:
```bash
# Option 1: Direct run
python3 -m bot.main

# Option 2: Run as daemon (recommended)
./start.sh start

# Option 3: With logs
python3 -m bot.main > logs/bot.log 2>&1 &
```

## Configuration

Create a `.env` file with the following variables:

```env
# ============================================
# Telegram Configuration (Required)
# ============================================
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# ============================================
# Proxy Configuration (Required for China servers)
# ============================================
# Example: http://127.0.0.1:7897 or socks5://user:pass@host:port
TELEGRAM_PROXY=http://127.0.0.1:7897

# ============================================
# Manifold API Configuration (Optional)
# ============================================
# Get from https://manifold.markets/profile (Edit > API Key)
# Required for placing bets
MANIFOLD_API_KEY=your_manifold_api_key

# ============================================
# AI API Configuration (Optional)
# ============================================
# Supports OpenAI-compatible APIs (Tencent Hunyuan, Zhipu GLM, etc.)
# Default: Tencent Hunyuan
AI_API_URL=https://api.hunyuan.cloud.tencent.com/v1/chat/completions
AI_API_KEY=your_ai_api_key
AI_MODEL=hunyuan-turbos-latest
```

## Proxy Configuration (For China Users)

If your server is in China, you need to configure a proxy to access Telegram API.

### Option 1: Use an existing proxy

Edit `.env` file:
```env
TELEGRAM_PROXY=http://your-proxy-host:port
```

Or with authentication:
```env
TELEGRAM_PROXY=socks5://username:password@host:port
```

### Option 2: Set up Mihomo/Clash proxy

1. Download Mihomo from [GitHub Releases](https://github.com/MetaCubeX/mihomo/releases)

2. Create a config file `proxy/config.yaml`:
```yaml
mixed-port: 7897
allow-lan: false
mode: rule

proxies:
  - name: "Your Proxy"
    server: your-server
    port: 443
    type: hysteria2
    password: your-password

proxy-groups:
  - name: "Proxy"
    proxies:
      - "Your Proxy"
    type: select

rules:
  - MATCH,Proxy
```

3. Run Mihomo using the start script:
```bash
./start.sh start
```

## Daemon Management

The `start.sh` script manages the bot and proxy as background services:

```bash
# Start bot and proxy
./start.sh start

# Stop all services
./start.sh stop

# Restart all services
./start.sh restart

# Check service status
./start.sh status

# View logs
./start.sh logs
```

## Getting API Keys

### Telegram Bot Token
1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow the instructions
3. Copy the token provided

### Manifold API Key
1. Go to [manifold.markets](https://manifold.markets)
2. Login and go to your profile
3. Click "Edit" and scroll to API Key section
4. Click refresh to generate a new key

### AI API Key (Tencent Hunyuan)
1. Go to [腾讯云混元](https://cloud.tencent.com/product/hunyuan)
2. Create a service and get API Key
3. Or use other OpenAI-compatible APIs

## Usage Examples

### Searching Markets
```
/markets AI
/markets election
```

### Viewing Market Details
```
/market cmSh4sR2K1T62D27P
```

### Placing a Bet
```
/bet cmSh4sR2K1T62D27P YES 100
/bet cmSh44R2K1T62D27P NO 50
```

### Checking Wallet
```
/wallet
/portfolio
```

### Using AI
```
/ai What do you think about the future of AI?
/analyze cmSh4sR2K1T62D27P
```

## Troubleshooting

### Bot not responding
1. Check if the bot is running: `./start.sh status`
2. View logs: `./start.sh logs`
3. Restart the bot: `./start.sh restart`

### Connection issues
1. Verify proxy is running: `./start.sh status`
2. Check proxy logs in `proxy/`
3. Test Telegram API connectivity

### AI not working
1. Verify `AI_API_KEY` is set in `.env`
2. Check API quota and validity
3. View bot logs for error messages

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
