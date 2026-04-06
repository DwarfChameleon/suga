# USDJPY Scalper (MT5)

Files:
- `USDJPY_Scalper.mq5`
- `USDJPY_Scalper.set`

## Install
1. In MT5, open `File -> Open Data Folder`.
2. Copy `USDJPY_Scalper.mq5` into `MQL5/Experts/`.
3. Copy `USDJPY_Scalper.set` anywhere convenient (for example `MQL5/Profiles/Tester/`).
4. In MT5, open `Tools -> MetaQuotes Language Editor`, compile `USDJPY_Scalper.mq5`.
5. In MT5, attach EA to `USDJPY` chart.
6. In EA Inputs, click `Load...` and select `USDJPY_Scalper.set`.
7. Enable `Algo Trading`.

## Notes
- This EA targets scalping and can attempt up to 5 entries every 3 minutes (`InpWindowSeconds=180`, `InpMaxTradesPerWindow=5`).
- Exact trade count is never guaranteed due to market conditions, spread filter, and risk protections.
- JPY pairs often use 3-digit quotes where `10 points = 1 pip`.
