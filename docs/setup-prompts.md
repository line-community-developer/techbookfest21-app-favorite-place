# 実サービスのセットアップ — Claude for Chrome 用プロンプト

好きな場所Bot を実際に動かすために、各サービスでキーやトークンを発行する。ブラウザでの操作は Claude for Chrome に任せ、ターミナルでの操作は自分で行う。

前提: このリポジトリを自分の GitHub アカウントに Fork し、手元に clone して `npm ci` まで済ませておく（Vercel は自分の GitHub にあるリポジトリしか読み込めないため）。

## 進める順番

| # | どこで | やること | 誰が |
|---|---|---|---|
| 0 | GitHub / ターミナル | Fork・clone・`npm ci` | 自分 |
| 1 | Supabase | プロジェクト作成・キーの場所を確認 | Chrome（プロンプトA） |
| 2 | ターミナル | migration 適用・`.env.local` 作成・確認スクリプト | 自分 |
| 3 | LINE Developers | Messaging API チャネル・LINEログインチャネル・LIFF | Chrome（プロンプトB） |
| 4 | Google Cloud | Maps JavaScript API キー | Chrome（プロンプトC） |
| 5 | Vercel | デプロイ・環境変数 | Chrome（プロンプトD） |
| 6 | LINE / Google | デプロイ先 URL を Webhook・LIFF・リファラ制限に反映 | Chrome（プロンプトE） |
| 7 | ターミナル / スマホ | リッチメニュー作成・実機で確認 | 自分 |

## 共通ルール（すべてのプロンプトの先頭に付ける）

```text
【守ってほしいこと】
- チャネルシークレット・アクセストークン・service_role key・APIキーなどの秘密の値は、チャット欄に書き出さないでください。値が表示されている画面を開いたら「ここに表示されています」と場所だけ伝えて止まってください。私が自分でコピーします。
- 支払い情報（クレジットカード）の入力や、有料プランへの変更が必要になったら、その手前で止まって私に確認してください。
- 既存のプロジェクト・チャネル・設定は変更・削除しないでください。新しく作るものだけを操作してください。
- 画面の文言が指示と違って迷ったら、推測で進めず、スクリーンショットの内容を説明して私に確認してください。
- 最後に、作ったものの名前と、秘密ではない値（URL・ID など）を表にまとめてください。
```

---

## プロンプトA: Supabase プロジェクトを作る

```text
（共通ルールをここに貼る）

Supabase（https://supabase.com/dashboard）で、LINE Bot 用のデータベースのプロジェクトを1つ作ってください。

1. 組織（Organization）は既存のものを使ってください。複数ある場合は一覧を見せて、どれを使うか私に聞いてください。
2. New project で次の設定にしてください。
   - Project name: favorite-place
   - Database Password: 「Generate a password」で自動生成してください。値はチャットに書かず、「生成しました。パスワードマネージャーに保存してください」とだけ伝えてください。
   - Region: Northeast Asia (Tokyo)
   - Plan: Free
3. 作成が終わるまで待ってください（数分かかります）。
4. Project Settings > General を開き、「Project ID（Reference ID）」を教えてください（これは秘密ではありません）。
5. Project Settings > API Keys を開いてください。「Legacy API keys」タブ（無ければ anon / service_role が表示されている場所）を探し、
   - Project URL（https://xxxx.supabase.co）を教えてください（秘密ではありません）
   - anon（public）キーと service_role（secret）キーが表示されている場所を伝えてください。値は書き出さないでください。
6. Storage を開き、まだ何もバケットが無いことを確認してください（バケットは migration で作るので、ここでは作らないでください）。

最後に「Project ID / Project URL / キーの場所」を表にしてください。
```

### A のあとに自分でやること（ターミナル）

```bash
cd techbookfest21-app-favorite-place
cp env.sample .env.local   # 値を埋める（下の「受け渡し表」参照）

supabase login                              # ブラウザが開くのでログイン
supabase link --project-ref <Project ID>    # DB パスワードを聞かれたら A で保存したもの
npm run db:push                             # supabase/migrations/0001_init.sql を適用
npm run check-supabase                      # RLS・バケットが設計どおりか確認
```

`check-supabase` がすべて ✅ になれば Supabase は完了。❌ が出たら、出力をそのまま Claude Code に貼る。

---

## プロンプトB: LINE のチャネルと LIFF を作る

```text
（共通ルールをここに貼る）

LINE Developers コンソール（https://developers.line.biz/console/）で、LINE Bot と LIFF アプリの準備をしてください。

【重要】Messaging API チャネルと LINEログインチャネルは、必ず同じプロバイダーに作ってください。プロバイダーが違うと、同じ人でもユーザーIDが別になり、アプリが動きません。

1. プロバイダー
   - 「favorite-place」という名前のプロバイダーを新しく作ってください。同名のものが既にあれば、作らずにそれを使ってよいか私に聞いてください。

2. Messaging API チャネル（Bot）
   - 上のプロバイダーで Messaging API チャネルを作ります。コンソール上で LINE公式アカウントの作成を案内された場合は、その案内に従って公式アカウントを作り、Messaging API を有効にして同じプロバイダーに紐づけてください。
   - アカウント名（チャネル名）: 好きな場所Bot
   - 作成後、「チャネル基本設定」タブで「チャネルシークレット」が表示されている場所を伝えてください（値は書かない）。
   - 「Messaging API設定」タブで「チャネルアクセストークン（長期）」を発行し、表示されている場所を伝えてください（値は書かない）。
   - 同じタブの「応答メッセージ」と「あいさつメッセージ」をオフにしてください（LINE Official Account Manager に移動する場合はそこで設定）。オンのままだと Bot の返信と二重になります。
   - 「Webhookの利用」はオンにしてください。Webhook URL はまだ空のままで構いません（後でデプロイ先の URL を入れます）。
   - 「Messaging API設定」タブの QR コードの場所を教えてください（私がスマホで友だち追加します）。

3. LINEログインチャネル（LIFF 用）
   - 同じプロバイダーで「LINEログイン」チャネルを新しく作ってください。
   - チャネル名: 好きな場所マップ
   - アプリタイプ: ウェブアプリ
   - 作成後、「チャネル基本設定」タブの「チャネルID」を教えてください（これは秘密ではありません）。

4. LIFF アプリ
   - LINEログインチャネルの「LIFF」タブで LIFF アプリを追加してください。
   - LIFFアプリ名: 好きな場所マップ
   - サイズ: Full
   - エンドポイントURL: https://example.com/liff（仮。デプロイ後に差し替えます）
   - Scope: openid と profile にチェック
   - 友だち追加オプション: On (Normal)
   - 作成後に表示される「LIFF ID」を教えてください（これは秘密ではありません）。

5. Messaging API チャネルの「Messaging API設定」タブで、「Bot basic ID」も教えてください。

最後に、プロバイダー名・2つのチャネル名・LINEログインのチャネルID・LIFF ID・Bot basic ID を表にしてください。
```

---

## プロンプトC: Google Maps の API キーを作る

```text
（共通ルールをここに貼る）

Google Cloud コンソール（https://console.cloud.google.com/）で、地図表示用の API キーを作ってください。

1. 新しいプロジェクトを作ってください。名前: favorite-place-map
2. そのプロジェクトで「Maps JavaScript API」を有効にしてください。
   - 請求先アカウント（Billing）の設定を求められたら、そこで止まって私に確認してください。カード情報は入力しないでください。
3. 「APIとサービス > 認証情報」で API キーを作成してください。キーの値はチャットに書かず、表示されている場所だけ伝えてください。
4. 作ったキーに制限をかけてください。
   - アプリケーションの制限: ウェブサイト
   - ウェブサイトの制限に次の2つを追加: http://localhost:3000/*  と  https://example.com/*（仮。デプロイ後に差し替えます）
   - API の制限: 「キーを制限」で Maps JavaScript API だけを選択
5. 保存して、制限の設定画面の内容を説明してください。

最後に、プロジェクト名・有効にした API・キーの名前・設定した制限を表にしてください。
```

---

## プロンプトD: Vercel にデプロイする

```text
（共通ルールをここに貼る）

Vercel（https://vercel.com/）で Next.js アプリをデプロイしてください。

1. 「Add New… > Project」から、私の GitHub アカウントにある techbookfest21-app-favorite-place（Fork したもの）を Import してください。
   - リポジトリが一覧に出ない場合は、GitHub 側の権限付与が必要なので、そこで止まって私に確認してください。
2. 設定
   - Project Name: favorite-place
   - Framework Preset: Next.js（「Other」になっていたら Next.js に変えてください）
   - Root Directory: そのまま（リポジトリの直下）
3. Environment Variables に次の8つのキーを追加します。値は私が入力するので、キー名だけ入力した状態で止まり、「値を入力してください」と伝えてください。私が入力し終えたら続けてください。
   LINE_CHANNEL_SECRET
   LINE_CHANNEL_ACCESS_TOKEN
   LINE_CHANNEL_ID
   NEXT_PUBLIC_LIFF_ID
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
4. Deploy を押し、ビルドが終わるまで待ってください。失敗したら、ビルドログの最後の30行ほどを説明してください。
5. 成功したら、本番の URL（https://xxxx.vercel.app）を教えてください。

最後に、プロジェクト名・Framework Preset・本番 URL を表にしてください。
```

---

## プロンプトE: デプロイ先の URL を各サービスに反映する

```text
（共通ルールをここに貼る）

デプロイ先の URL が決まったので、各サービスの仮の URL を差し替えてください。
本番 URL: https://<D で確認した URL>

1. LINE Developers コンソール
   - Messaging API チャネル「好きな場所Bot」>「Messaging API設定」> Webhook URL に
     https://<本番URL>/api/webhook を入れて「更新」、続けて「検証」を押して結果（成功／失敗とメッセージ）を教えてください。
   - LINEログインチャネル「好きな場所マップ」>「LIFF」タブ > LIFF アプリのエンドポイントURLを
     https://<本番URL>/liff に変更して保存してください。
2. Google Cloud コンソール（プロジェクト favorite-place-map）
   - API キーのウェブサイトの制限で、https://example.com/* を https://<本番URL>/* に置き換えて保存してください。localhost は残してください。

最後に、変更した3か所と、Webhook の検証結果を表にしてください。
```

---

## 受け渡し表（`.env.local` と Vercel に入れる値）

| キー | どこから | 秘密 |
|---|---|---|
| `LINE_CHANNEL_SECRET` | B-2: Messaging API チャネル > チャネル基本設定 | 🔒 |
| `LINE_CHANNEL_ACCESS_TOKEN` | B-2: Messaging API設定 > チャネルアクセストークン（長期） | 🔒 |
| `NEXT_PUBLIC_LIFF_ID` | B-4: LIFF ID | 公開 |
| `LINE_CHANNEL_ID` | B-3: **LINEログイン**チャネルのチャネルID（Messaging API ではない） | 公開 |
| `NEXT_PUBLIC_SUPABASE_URL` | A-5: Project URL | 公開 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | A-5: anon（public） | 公開前提 |
| `SUPABASE_SERVICE_ROLE_KEY` | A-5: service_role（secret） | 🔒 |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | C-3: API キー（リファラ制限つき） | 公開前提 |

🔒 の値は Chrome にもチャットにも書かせず、画面から自分でコピーする。`.env.local` は `.gitignore` 済み。

## 7. 最後に自分でやること

```bash
# 状態ごとのリッチメニュー4枚（画像は assets/rich-menu/ の 2500x843）を作り、idle をデフォルトにする
npm run create-rich-menu
```

スマホで B の QR コードから友だち追加し、次を確かめる。

- [ ] テキストを送るとおうむ返しに「📍 場所を登録する」「🗺 地図で見る」が付く
- [ ] 「📍 場所を登録する」→「📍 位置情報を送る」で位置情報を送ると「登録しました」
- [ ] 「📷 写真を送る」で写真、続けてコメントを送ると Supabase の Table Editor に行が増える
- [ ] 「✅ 終了」で idle に戻り、次のテキストがおうむ返しになる
- [ ] リッチメニューから LIFF が開き、地図にピン → 詳細 → 共有できる
- [ ] `npm run check-supabase` がすべて ✅
