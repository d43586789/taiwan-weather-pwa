# 台灣天氣 PWA

這一版不需要 Xcode，也不需要 Mac。你可以在 Windows 修改與部署，再用 iPhone Safari「加入主畫面」。

## 功能

- 首頁
  - 瀏覽器 GPS 定位
  - 由中央氣象署 `F-D0047-093` 內各鄉鎮代表點，自動找出離目前座標最近的鄉鎮
  - 目前溫度 / 天氣
  - 未來 5 天
  - 約未來 24 小時預報
  - 濕度 / 體感 / 風速 / 降雨機率
- 雷達回波圖
- 東亞紅外線彩色衛星雲圖
- 日累積雨量圖
- 颱風路徑潛勢：開啟中央氣象署官方頁面
- 台灣溫度分布：開啟中央氣象署官方頁面

## 重要：不能直接雙擊 index.html

iPhone 的定位與 PWA Service Worker 需要 HTTPS。
請把此資料夾部署到 GitHub Pages、Cloudflare Pages、Netlify 等 HTTPS 網站。

## 最容易：GitHub Pages

1. 在 Windows 解壓縮此 ZIP。
2. 到 GitHub 建立新 repository，例如 `taiwan-weather-pwa`。
3. 把本資料夾內的全部檔案上傳到 repository 根目錄。
4. Repository → Settings → Pages。
5. Build and deployment 選 `Deploy from a branch`。
6. Branch 選 `main` / `(root)` → Save。
7. 等 GitHub 產生 `https://你的帳號.github.io/taiwan-weather-pwa/`。
8. 用 iPhone Safari 開啟該網址。
9. 右上角設定輸入中央氣象署 API Authorization。
10. Safari 分享按鈕 →「加入主畫面」。

## API Key 安全性

這個 PWA 是純前端個人用版本，API 授權碼會存在瀏覽器 localStorage，而且每次 API 呼叫都會由瀏覽器送到中央氣象署。
因此它不像後端伺服器那樣能真正隱藏 API Key。

如果未來要公開給很多人使用，建議加一個 Cloudflare Worker / 自己的後端代理，把 CWA Key 放在伺服器端 Secret。

## 本機預覽

Windows 可安裝 Python 後：

```powershell
cd TaiwanWeatherPWA
python -m http.server 8080
```

然後電腦瀏覽器開：

`http://localhost:8080`

localhost 可測介面，但 iPhone 要透過 HTTPS 部署網址才能正常使用定位/PWA。

## 資料來源

交通部中央氣象署：
- F-D0047-093 全臺鄉鎮預報
- O-A0058-002 雷達回波圖
- O-B0028-002 東亞紅外線彩色雲圖
- O-A0040-002 日累積雨量圖


## v2 修正
- 溫度分布頁改為透過 O-A0038-001 API 讀取官方 ProductURL，直接在 PWA 顯示圖片。
- 颱風頁改用 W-C0034-005 檢查目前是否有熱帶氣旋資料，並使用正確官方 PTA.html 路徑潛勢頁。
- 無警報颱風時會清楚顯示『目前沒有可顯示的警報颱風路徑潛勢圖』，而不是看起來像故障。
