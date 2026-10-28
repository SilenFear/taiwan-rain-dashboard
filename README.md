# 山雨 RAIN WATCH

第 10 題「全台即時雨量看板」｜資通四勤 121271020 周柏睿

靜態 HTML、CSS、JavaScript 網站，部署於 GitHub Pages。沒有建置依賴、個人授權碼或後端服務。

## 資料來源

- 機關：交通部中央氣象署。
- 資料集：[雨量觀測站－雨量資料 O-A0002-001](https://data.gov.tw/dataset/9177)。
- 直接資料來源：[氣象署官方公開 JSON](https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Observation/O-A0002-001.json)。
- 授權：[政府資料開放授權條款－第 1 版](https://data.gov.tw/license)。

原作業提供的是需要會員授權碼的 REST API。政府資料開放平台上同一資料集的 JSON 下載連結會導向上述官方公開檔案，提供相同的雨量觀測欄位。本作品從瀏覽器直接讀取這份公開檔案，無須私人授權碼，也沒有代理、內嵌資料或跨域繞過。檔案外層是 `cwaopendata.dataset.Station`，有別於 REST API 的 `records.Station`。

## 功能

- 開啟時立即抓取，完成後每 600 秒自動抓取，提供倒數與立即更新。
- 顯示最新測站觀測時間、網頁最後成功抓取時間；觀測超過 30 分鐘，或時間持續 30 分鐘未變，顯示延遲提醒。
- 全台最高 1 小時雨量、有雨站數、達 40 mm 警示站數、有效測站數。
- 篩選範圍雨量前 8 名長條圖；開啟後各次成功抓取的全台最高 1 小時雨量折線。
- 搜尋測站、鄉鎮、代碼；縣市與雨量條件篩選；測站分頁。
- 1 小時雨量 `>= 40` mm 醒目提醒；負值、空值不當成零。
- 30 秒逾時；失敗後保留上次成功資料，10 分鐘後重試。
- 支援 375px 手機版面與電腦版面。

圖表只記錄此頁開啟後真實成功取得的資料，不補造歷史。即使資料本身尚未更新，新的成功抓取也會產生時間點；這反映數值未變，並不假裝資料觀測時間前進。

## 本機執行

```sh
npm run dev
# http://127.0.0.1:8765/
npm test
```

## GitHub Pages

Settings → Pages → Deploy from a branch → `main` / `(root)`。

公開網址：https://silenfear.github.io/taiwan-rain-dashboard/

保留此儲存庫與 Pages 服務，供作業評分時存取。
