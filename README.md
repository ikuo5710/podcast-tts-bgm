# Bulk TTS Processor

テキストファイルを一括でポッドキャスト風の音声に変換するツールです。Google GeminiのTTS APIを利用して、指定されたテキストファイル群を音声化し、オプションでBGMを合成してMP3ファイルとして出力します。

## 主な機能

-   **テキストの一括音声化**: 指定したフォルダ内のすべての`.txt`ファイルを音声に変換します。
-   **BGM合成**: 指定したBGMファイルを背景に合成できます。BGMはスピーチに合わせて自動で音量が調整されます（サイドチェインコンプレッション）。
-   **並列処理**: GraphAIを利用して、複数のファイルを効率的に並列処理します。
-   **簡単なコマンドライン操作**: コマンドラインから入力フォルダ、BGMファイル、出力フォルダを簡単に指定できます。

## 必要なもの

-   [Node.js](https://nodejs.org/) (v20以上を推奨)
-   [Google Gemini APIキー](https://ai.google.dev/gemini-api)

## インストール方法

1.  リポジトリをクローンします。
    ```bash
    git clone https://github.com/your-username/bulk-tts-processor.git
    cd bulk-tts-processor
    ```

2.  依存パッケージをインストールします。
    ```bash
    npm install
    ```

3.  環境変数を設定します。
    -   `.env.example` ファイルをコピーして `.env` という名前のファイルを作成します。
    -   `.env` ファイルを開き、`your_gemini_api_key` の部分をあなたのGoogle Gemini APIキーに置き換えてください。

    ```
    # .env
    GEMINI_API_KEY="ここにあなたのAPIキーを貼り付け"
    ```

## 使い方

1.  `inputs` フォルダ（または指定した入力フォルダ）に、音声化したいテキストファイル（`.txt`）を配置します。
2.  （オプション）BGMを使用する場合は、任意の場所にBGMファイルを配置します。
3.  以下のコマンドを実行します。

### 基本的な使い方（BGMなし）

`inputs` フォルダのテキストを `outputs` フォルダに音声ファイルとして出力します。

```bash
npm run prod
```

### BGMを指定する場合

BGMファイルを指定して実行します。

```bash
npm run prod -- -b ./bgm/digital_wave.mp3
```

### 入力・出力フォルダを指定する場合

```bash
npm run prod -- -i ./my_texts -o ./my_podcasts -b ./music/bgm.mp3
```

### コマンドラインオプション

-   `-i, --input-dir`: 入力テキストファイル（`.txt`）が含まれるディレクトリ（デフォルト: `inputs`）
-   `-b, --bgm`: BGMファイルのパス（オプション）
-   `-o, --output-dir`: 生成されたMP3ファイルを保存するディレクトリ（デフォルト: `outputs`）
-   `-h, --help`: ヘルプを表示

## ライセンス

このプロジェクトは [ISC License](LICENSE) の下で公開されています。
