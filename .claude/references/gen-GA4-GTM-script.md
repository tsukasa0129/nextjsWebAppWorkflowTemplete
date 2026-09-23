# アナリティクス設計指示に従ったga4、,gtmのセットアップのスクリプト作成

## 技術選定
 - 言語：node.js


##アウトプット先ディレクトリ
 - GA4 イベント・ディメンション設定のGA4設定のスクリプト：`.${project-root}/script/setup-ga4.mjs`
 - GA4 イベント・ディメンション設定のGTM設定のスクリプト：`.${project-root}/script/setup-gtm.mjs`
 - 環境（`package.json`）は`.${project-root}/script/package.json`に作成、または既にあれば必要な分を更新


## スクリプト例
 - GA4 イベント・ディメンション設定のGA4設定のスクリプト：`references/ecample/setup-ga4.mjs`
 - GA4 イベント・ディメンション設定のGTM設定のスクリプト：`references/ecample/setup-gtm.mjs`





## 実行順序の説明

2. 作成した設計書を渡して以下の処理をサブエージェントに依頼
・ GA4の設定をAPIで行うnode.jsスクリプトの作成（@ga4APIDoc.md） 
・ 設計書に則ったGTMの設定をAPIで行うnode.jsスクリプトの作成（@gtm-setting.md）



