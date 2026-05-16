# AR.js Location Based AR サンプル

GPS 座標（latitude / longitude）を使って、特定の地点に 3D オブジェクトを表示する AR.js のサンプルです。

## 構成

- `index.html` — AR シーン本体
  - **看板風オブジェクト**（座標 `35.717672, 139.987239`）
    - 白いパネル + 青いフレーム
    - "Welcome!" のタイトル文字
    - 座標表示のサブテキスト
    - 茶色の支柱
  - `look-at="[gps-new-camera]"` でカメラ方向に常時正対
- `redirect.html` — 補助ページ

## 動作要件

Location Based AR は **HTTPS 環境でのみ** カメラ／GPS にアクセスできます。スマホ実機でテストしてください。

### ローカルで HTTPS 配信する例

#### 1. ngrok を使う

```bash
# 適当な静的サーバを起動
npx http-server -p 8080

# 別ターミナルで
ngrok http 8080
```

ngrok が発行する `https://xxxx.ngrok-free.app` をスマホで開きます。

#### 2. GitHub Pages にデプロイ

リポジトリに push して Pages を有効化するだけで HTTPS 配信されます。

## 表示位置のカスタマイズ

`index.html` の `gps-new-entity-place` の値を、表示したい地点の座標に書き換えてください。

```html
<a-entity
    gps-new-entity-place="latitude: 35.717672; longitude: 139.987239"
    look-at="[gps-new-camera]"
    scale="30 30 30">
    <!-- 看板のパーツ -->
</a-entity>
```

座標は Google Maps で地点を右クリック → 表示された数値（緯度, 経度）をコピーできます。

## 看板の見た目を変える

- 文字: `<a-text value="...">` の `value` を編集
- 色: `<a-plane color="#FFFFFF">` や `<a-text color="#0066CC">` を変更
- サイズ全体: 親 `<a-entity>` の `scale="30 30 30"` を調整
- 画像看板にしたい: パネルを以下のように差し替え
  ```html
  <a-plane width="4" height="2.4" src="sign.png"
           material="side: double; shader: flat"
           position="0 3 0"></a-plane>
  ```
  `sign.png` をリポジトリに置いてください。

## 動作確認のコツ

- 屋外で空が見える場所で試す（屋内だと GPS 精度が落ちる）
- iOS Safari の場合、初回アクセス時に「カメラ」「位置情報」両方の許可ダイアログを許可
- 画面左上に現在地と GPS 精度（`±◯m`）が出ます。精度が悪い間はオブジェクトが揺れます
- スケールは `scale="20 20 20"` など大きめにしないと遠くから見えません

## 参考

- AR.js: https://github.com/AR-js-org/AR.js
- A-Frame: https://aframe.io/
