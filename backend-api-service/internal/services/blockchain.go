package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"bytes"
	"math/big"

	"mindbet-backend/internal/models"
	"mindbet-backend/pkg/config"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

func UploadToIPFS(content map[string]interface{}) (string, error) {
	ipfsURL := "http://localhost:5001"
	if config.GlobalConfig != nil {
		ipfsURL = config.GlobalConfig.IPFS.APIURL
	}

	jsonData, err := json.Marshal(content)
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("%s/api/v0/add", ipfsURL)
	req, err := http.NewRequest("POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return "", err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("IPFS upload failed: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result struct {
		Hash string `json:"Hash"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}

	return result.Hash, nil
}

func GetFromIPFS(cid string) ([]byte, error) {
	ipfsURL := "http://localhost:5001"
	if config.GlobalConfig != nil {
		ipfsURL = config.GlobalConfig.IPFS.APIURL
	}

	url := fmt.Sprintf("%s/api/v0/cat?arg=%s", ipfsURL, cid)
	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("IPFS get failed: %s", resp.Status)
	}

	return io.ReadAll(resp.Body)
}

func GenerateContentHash(content map[string]interface{}) string {
	jsonData, err := json.Marshal(content)
	if err != nil {
		return ""
	}

	hash := sha256.Sum256(jsonData)
	return "0x" + hex.EncodeToString(hash[:])
}

func CalculateClaimAmount(marketID uint64, userAddress string) (uint64, uint64, bool, error) {
	var market models.Market
	if err := models.DB.Where("id = ? OR chain_id = ?", marketID, marketID).First(&market).Error; err != nil {
		return 0, 0, false, err
	}

	var tx models.Transaction
	if err := models.DB.Where("content_hash = ? AND user_address = ? AND tx_type = ?",
		market.ContentHash, userAddress, models.TxTypeBet).First(&tx).Error; err != nil {
		return 0, 0, false, err
	}

	if tx.Outcome == nil {
		return 0, 0, false, fmt.Errorf("no bet outcome found")
	}

	betType := *tx.Outcome == 1
	winningSide := market.Result == models.MarketResultYes

	if betType != winningSide {
		return 0, tx.Amount, betType, nil
	}

	winningPool := market.TotalYesPool
	losingPool := market.TotalNoPool
	if !winningSide {
		winningPool = market.TotalNoPool
		losingPool = market.TotalYesPool
	}

	totalPool := winningPool + losingPool
	platformFee := totalPool * 300 / 10000
	creatorFee := totalPool * 100 / 10000
	groupOwnerFee := totalPool * 100 / 10000
	totalFees := platformFee + creatorFee + groupOwnerFee
	distributablePool := totalPool - totalFees

	claimAmount := (tx.Amount * distributablePool) / winningPool

	return claimAmount, tx.Amount, betType, nil
}

func VerifySignature(address, message, signature string) (bool, error) {
	sigBytes := common.FromHex(signature)
	if len(sigBytes) != 65 {
		return false, fmt.Errorf("invalid signature length")
	}

	if sigBytes[64] >= 27 {
		sigBytes[64] -= 27
	}

	hash := crypto.Keccak256Hash([]byte("\x19Ethereum Signed Message:\n" + string(len(message)) + message))

	pubKey, err := crypto.SigToPub(hash.Bytes(), sigBytes)
	if err != nil {
		return false, err
	}

	recoveredAddr := crypto.PubkeyToAddress(*pubKey)
	expectedAddr := common.HexToAddress(address)

	return recoveredAddr == expectedAddr, nil
}

func GetBalance(address string) (string, error) {
	rpcURL := "https://testnet-rpc.monad.xyz"
	if config.GlobalConfig != nil {
		rpcURL = config.GlobalConfig.Chain.RPCURL
	}

	reqBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "eth_getBalance",
		"params":  []interface{}{address, "latest"},
		"id":      1,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "0", err
	}

	resp, err := http.Post(rpcURL, "application/json", bytes.NewReader(jsonData))
	if err != nil {
		return "0", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "0", err
	}

	var result struct {
		Result string `json:"result"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "0", err
	}

	balanceWei := new(big.Int)
	balanceWei.SetString(result.Result[2:], 16)

	balanceMon := new(big.Float).Quo(
		new(big.Float).SetInt(balanceWei),
		new(big.Float).SetFloat64(1e18),
	)

	return balanceMon.Text('f', 6), nil
}
