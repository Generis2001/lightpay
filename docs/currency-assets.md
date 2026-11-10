# Currency artwork research

Reviewed 8 November 2026 against the currency union in `packages/types/src/wallet.ts`, the wallet screen, prepared Flutterwave corridors, and the product requirements. Wallet entries are NGN, USD, BTC, ETH, SOL and BNB. NGN uses Paystack; BTC/ETH/SOL/BNB adapters are prepared with Fireblocks and require activation. USD remains planned. The seven additional fiat currencies below are prepared payout currencies, not wallet balances or receiving accounts.

| Currency | Reference / asset source                                                                                                                                                        | Representation in LightPay                                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NGN      | [Central Bank of Nigeria: Currency](https://www.cbn.gov.ng/Currency/)                                                                                                           | Standard naira symbol **₦**, with NGN and Nigerian Naira labels. Fiat currencies have no universal brand logo; a central bank's corporate logo would identify the institution, not the currency. |
| USD      | [US Currency Education Program: denominations](https://www.uscurrency.gov/denominations)                                                                                        | Standard dollar symbol **$**, with USD and US Dollar labels. No invented dollar emblem or emoji flag.                                                                                            |
| GHS | [Bank of Ghana](https://www.bog.gov.gh/), Bank Notes & Coins section | Ghana cedi; **GH₵** and GHS labels. |
| KES | [Central Bank of Kenya: currency history](https://www.centralbank.go.ke/currency-history/) | Kenyan shilling; **KSh** and KES labels. |
| UGX | [Bank of Uganda](https://www.bou.or.ug/) | Ugandan shilling; **USh** and UGX labels. |
| TZS | [Bank of Tanzania](https://www.bot.go.tz/) | Tanzanian shilling; **TSh** and TZS labels. |
| RWF | [National Bank of Rwanda](https://www.bnr.rw/) | Rwandan franc; **FRw** and RWF labels. |
| ZAR | [South African Reserve Bank: banknotes and coin](https://www.resbank.co.za/en/home/what-we-do/banknotes-and-coin) | South African rand; **R** and ZAR labels. |
| ZMW | [Bank of Zambia: banknotes and coins](https://www.boz.zm/bank-notes-and-coins.htm) | Zambian kwacha; **K** and ZMW labels. |
| BTC      | [bitcoin.org](https://bitcoin.org/en/); [original icon](https://bitcoin.org/img/icons/logo_ios.png)                                                                             | Original orange Bitcoin icon, stored as `btc.png`. Bitcoin is decentralized; this is the recognized mark distributed by bitcoin.org, rather than an issuer's corporate logo.                     |
| ETH      | [Ethereum brand assets](https://ethereum.org/en/assets/); [diamond glyph](https://ethereum.org/images/assets/svgs/eth-diamond-glyph.svg)                                        | Original Ethereum diamond SVG, stored as `eth.svg`.                                                                                                                                              |
| SOL      | [Solana Foundation brand assets](https://solana.com/branding); [gradient logomark](https://solana.com/src/img/branding/solanaLogoMark.svg)                                      | Original gradient logomark, stored as `sol.svg`. The asset was retrieved from the official page in a browser because command-line requests returned HTTP 429.                                    |
| BNB      | [BNB Chain brand guidelines](https://www.bnbchain.org/en/brand-guidelines); [yellow symbol](https://www.bnbchain.org/images/brand-guidelines/svg/BNB%20Chain_Symbol_Yellow.svg) | Original yellow symbol, stored as `bnb.svg`.                                                                                                                                                     |

All four crypto images are bundled locally in `apps/mobile/assets/currencies`; the APK does not depend on third-party icon CDNs. `CurrencyIcon` and the currency registry reuse them. Artwork proportions and colors are preserved. Research establishes provenance, not a transfer of trademark rights; the respective brand guidelines govern use.

The additional fiat issuer sites above were checked over HTTPS. The Ghana currency subpage returned 502, so its official homepage's Bank Notes & Coins section was used. Kenya's `/currency/` URL redirects to currency history. Uganda, Rwanda and Zambia render much of their information with JavaScript. None supplies a universal currency brand logo that should replace a currency symbol; institutional logos identify the bank. Shilling/franc/kwacha abbreviations vary across sources, so the ISO currency code remains the unambiguous label in payout quotes. These references establish currency/issuer provenance, not Flutterwave bank coverage.

Telecom and TV selections use provider names or generic service icons instead of colored emoji or fabricated letter logos. Those generic icons indicate actions, not provider brands. Add provider artwork only after obtaining it from the provider's own brand resources.

LightPay's existing icon/splash PNGs are blank backgrounds, and this repository contains no approved LightPay logo artwork. The app uses the LightPay name rather than presenting an invented monogram as an official logo. Approved LightPay artwork remains needed for launcher, adaptive icon, splash, and favicon assets.

## Asset fingerprints (SHA-256)

```text
bnb.svg  b8ff1ce0b5af2e2d9bcf5ec89fedd5224079f4f7267e306e23e8d691024f5eff
btc.png  70a39ca6f8a889fa58da5c6c2489a18552d91e3e16b90be73442c947bd48c043
eth.svg  335f39552e96193121de4c8d55d8170ea0fc061dfa7540a78a21699a762d0088
sol.svg  3d3401109aa061dec40a8659f1847817a8e647f98de1e65e76e86a95bbe1f08a
```
