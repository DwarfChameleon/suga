#property strict
#property version   "1.00"
#property description "USDJPY scalper template with risk controls and trade throttling."

#include <Trade/Trade.mqh>

input group "General"
input ulong            InpMagicNumber              = 26030601;
input ENUM_TIMEFRAMES  InpSignalTimeframe          = PERIOD_M1;
input bool             InpOnePositionAtATime       = true;

input group "Risk"
input double           InpRiskPercent              = 0.25;  // % of balance risked per trade
input double           InpMaxRiskMoneyPerTrade     = 2.00;  // cap risk budget in account currency
input double           InpMaxMarginMoneyPerTrade   = 2.00;  // cap required margin in account currency
input int              InpStopLossPoints           = 120;   // 12.0 pips on 3-digit JPY quote
input int              InpTakeProfitPoints         = 60;    // 6.0 pips on 3-digit JPY quote
input bool             InpUseDailyLossStop         = true;
input double           InpMaxDailyLossPercent      = 1.0;

input group "Execution Filters"
input int              InpMaxSpreadPoints          = 20;    // 2.0 pips if 1 pip = 10 points
input int              InpMaxSlippagePoints        = 10;    // 1.0 pip
input bool             InpUseSessionFilter         = true;
input int              InpSessionStartHour         = 1;     // server time
input int              InpSessionEndHour           = 22;    // server time

input group "Scalping Pace"
input int              InpWindowSeconds            = 180;   // 3 minutes
input int              InpMaxTradesPerWindow       = 30;    // max entries per window
input int              InpMinSecondsBetweenEntries = 0;

input group "Money Exit Controls"
input bool             InpUseMoneyTakeProfit       = true;
input double           InpTakeProfitMoney1         = 0.15;  // account currency
input double           InpTakeProfitMoney2         = 0.00;  // optional
input double           InpTakeProfitMoney3         = 0.00;  // optional
input bool             InpUseMoneyStopLoss         = true;
input double           InpMaxLossMoneyPerTrade     = 0.30;  // account currency
input bool             InpImmediateReentry         = true;
input bool             InpReentryWithoutSignal     = true;

input group "Signal"
input int              InpFastEMA                  = 9;
input int              InpSlowEMA                  = 21;
input int              InpRSIPeriod                = 7;
input double           InpBuyRSIMin                = 52.0;
input double           InpSellRSIMax               = 48.0;

CTrade   g_trade;
int      g_fastHandle = INVALID_HANDLE;
int      g_slowHandle = INVALID_HANDLE;
int      g_rsiHandle  = INVALID_HANDLE;

datetime g_lastEntryTime = 0;
datetime g_windowStart   = 0;
int      g_windowTrades  = 0;
double   g_dayStartEquity = 0.0;
int      g_dayOfYear      = -1;
bool     g_reentryRequested = false;
int      g_lastClosedDirection = 0;
string   g_lastSkipReason = "INIT";

enum SignalType
{
   SIGNAL_NONE = 0,
   SIGNAL_BUY  = 1,
   SIGNAL_SELL = -1
};

void ResetDayBaselineIfNeeded()
{
   MqlDateTime nowDt;
   TimeToStruct(TimeCurrent(), nowDt);
   if(g_dayOfYear != nowDt.day_of_year)
   {
      g_dayOfYear = nowDt.day_of_year;
      g_dayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   }
}

bool IsWithinSession()
{
   if(!InpUseSessionFilter)
      return true;

   MqlDateTime nowDt;
   TimeToStruct(TimeCurrent(), nowDt);
   int h = nowDt.hour;

   if(InpSessionStartHour == InpSessionEndHour)
      return true;

   if(InpSessionStartHour < InpSessionEndHour)
      return (h >= InpSessionStartHour && h < InpSessionEndHour);

   return (h >= InpSessionStartHour || h < InpSessionEndHour);
}

bool IsSpreadOk()
{
   long spread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   return (spread >= 0 && spread <= InpMaxSpreadPoints);
}

bool IsDailyLossOk()
{
   if(!InpUseDailyLossStop)
      return true;
   if(g_dayStartEquity <= 0.0)
      return true;

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double lossPct = (g_dayStartEquity - equity) / g_dayStartEquity * 100.0;
   return (lossPct < InpMaxDailyLossPercent);
}

void ResetWindowIfNeeded()
{
   datetime nowTs = TimeCurrent();
   if(g_windowStart == 0 || (int)(nowTs - g_windowStart) >= InpWindowSeconds)
   {
      g_windowStart = nowTs;
      g_windowTrades = 0;
   }
}

bool HasOwnOpenPosition()
{
   if(!PositionSelect(_Symbol))
      return false;

   long magic = (long)PositionGetInteger(POSITION_MAGIC);
   return ((ulong)magic == InpMagicNumber);
}

bool SelectOwnPosition()
{
   if(!PositionSelect(_Symbol))
      return false;

   long magic = (long)PositionGetInteger(POSITION_MAGIC);
   return ((ulong)magic == InpMagicNumber);
}

bool HasAnyOpenPositionOnSymbol()
{
   return PositionSelect(_Symbol);
}

double NormalizeVolume(double volume)
{
   double minVol = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxVol = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double step   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

   if(step <= 0.0)
      return 0.0;

   volume = MathMax(minVol, MathMin(maxVol, volume));
   volume = MathFloor(volume / step) * step;
   return NormalizeDouble(volume, 2);
}

double GetMaxLotsByMargin(ENUM_ORDER_TYPE orderType)
{
   if(InpMaxMarginMoneyPerTrade <= 0.0)
      return DBL_MAX;

   double price = (orderType == ORDER_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_ASK) : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(price <= 0.0)
   {
      g_lastSkipReason = "SKIP: bad price";
      return 0.0;
   }

   double minVol = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxVol = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double step   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   if(minVol <= 0.0 || maxVol <= 0.0 || step <= 0.0)
   {
      g_lastSkipReason = "SKIP: bad volume settings";
      return 0.0;
   }

   double marginForMin = 0.0;
   if(!OrderCalcMargin(orderType, _Symbol, minVol, price, marginForMin))
   {
      g_lastSkipReason = "SKIP: margin calc failed";
      return 0.0;
   }
   if(marginForMin > InpMaxMarginMoneyPerTrade)
   {
      g_lastSkipReason = "SKIP: margin > cap at min lot";
      return 0.0;
   }

   double low = minVol;
   double high = maxVol;
   double best = minVol;

   for(int i = 0; i < 24; i++)
   {
      double mid = (low + high) * 0.5;
      mid = NormalizeVolume(mid);
      if(mid < minVol) mid = minVol;
      if(mid > maxVol) mid = maxVol;

      double margin = 0.0;
      bool ok = OrderCalcMargin(orderType, _Symbol, mid, price, margin);
      if(!ok || margin > InpMaxMarginMoneyPerTrade)
      {
         high = mid - step;
      }
      else
      {
         best = mid;
         low = mid + step;
      }
   }

   return NormalizeVolume(best);
}

double CalculateLotsByRisk(ENUM_ORDER_TYPE orderType)
{
   if(InpStopLossPoints <= 0)
   {
      g_lastSkipReason = "SKIP: invalid stop loss points";
      return 0.0;
   }

   double balance   = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskMoney = 0.0;
   if(InpRiskPercent > 0.0)
      riskMoney = balance * (InpRiskPercent / 100.0);
   if(InpMaxRiskMoneyPerTrade > 0.0)
      riskMoney = (riskMoney > 0.0) ? MathMin(riskMoney, InpMaxRiskMoneyPerTrade) : InpMaxRiskMoneyPerTrade;
   if(riskMoney <= 0.0)
   {
      g_lastSkipReason = "SKIP: risk money is zero";
      return 0.0;
   }

   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double pointSize = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(tickValue <= 0.0 || tickSize <= 0.0 || pointSize <= 0.0)
   {
      g_lastSkipReason = "SKIP: bad symbol tick values";
      return 0.0;
   }

   double moneyPerPointPerLot = tickValue * (pointSize / tickSize);
   if(moneyPerPointPerLot <= 0.0)
   {
      g_lastSkipReason = "SKIP: money/point calc failed";
      return 0.0;
   }

   double lots = riskMoney / (InpStopLossPoints * moneyPerPointPerLot);
   lots = NormalizeVolume(lots);
   double maxLotsByMargin = GetMaxLotsByMargin(orderType);
   if(maxLotsByMargin <= 0.0)
   {
      g_lastSkipReason = "SKIP: margin > $ cap";
      return 0.0;
   }
   lots = MathMin(lots, maxLotsByMargin);
   return NormalizeVolume(lots);
}

SignalType GetSignal()
{
   double fast[], slow[], rsi[];
   ArrayResize(fast, 3);
   ArrayResize(slow, 3);
   ArrayResize(rsi, 3);
   ArraySetAsSeries(fast, true);
   ArraySetAsSeries(slow, true);
   ArraySetAsSeries(rsi, true);

   if(CopyBuffer(g_fastHandle, 0, 0, 3, fast) != 3) return SIGNAL_NONE;
   if(CopyBuffer(g_slowHandle, 0, 0, 3, slow) != 3) return SIGNAL_NONE;
   if(CopyBuffer(g_rsiHandle,  0, 0, 3, rsi)  != 3) return SIGNAL_NONE;

   bool buyTrend  = (fast[1] > slow[1] && rsi[1] >= InpBuyRSIMin);
   bool sellTrend = (fast[1] < slow[1] && rsi[1] <= InpSellRSIMax);

   if(buyTrend)  return SIGNAL_BUY;
   if(sellTrend) return SIGNAL_SELL;
   return SIGNAL_NONE;
}

double GetMoneyTakeProfitThreshold()
{
   if(InpTakeProfitMoney1 > 0.0) return InpTakeProfitMoney1;
   if(InpTakeProfitMoney2 > 0.0) return InpTakeProfitMoney2;
   if(InpTakeProfitMoney3 > 0.0) return InpTakeProfitMoney3;
   return 0.0;
}

void ManageOpenPosition()
{
   if(!SelectOwnPosition())
      return;

   double profitMoney = PositionGetDouble(POSITION_PROFIT);
   long posType = PositionGetInteger(POSITION_TYPE);
   bool shouldCloseForProfit = false;
   bool shouldCloseForLoss = false;

   if(InpUseMoneyTakeProfit)
   {
      double target = GetMoneyTakeProfitThreshold();
      if(target > 0.0 && profitMoney >= target)
         shouldCloseForProfit = true;
   }

   if(InpUseMoneyStopLoss && InpMaxLossMoneyPerTrade > 0.0)
   {
      if(profitMoney <= -InpMaxLossMoneyPerTrade)
         shouldCloseForLoss = true;
   }

   if(!shouldCloseForProfit && !shouldCloseForLoss)
      return;

   g_trade.SetExpertMagicNumber(InpMagicNumber);
   g_trade.SetDeviationInPoints(InpMaxSlippagePoints);
   if(g_trade.PositionClose(_Symbol))
   {
      if(InpImmediateReentry)
      {
         g_lastClosedDirection = (posType == POSITION_TYPE_BUY) ? 1 : -1;
         g_reentryRequested = true;
      }
   }
}

bool OpenTrade(SignalType signal)
{
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   if(point <= 0.0)
   {
      g_lastSkipReason = "SKIP: bad point size";
      return false;
   }

   g_trade.SetExpertMagicNumber(InpMagicNumber);
   g_trade.SetDeviationInPoints(InpMaxSlippagePoints);

   bool ok = false;
   if(signal == SIGNAL_BUY)
   {
      double lots = CalculateLotsByRisk(ORDER_TYPE_BUY);
      if(lots <= 0.0)
         return false;
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double sl  = NormalizeDouble(ask - InpStopLossPoints * point, digits);
      double tp  = NormalizeDouble(ask + InpTakeProfitPoints * point, digits);
      ok = g_trade.Buy(lots, _Symbol, 0.0, sl, tp, "USDJPY Scalper BUY");
   }
   else if(signal == SIGNAL_SELL)
   {
      double lots = CalculateLotsByRisk(ORDER_TYPE_SELL);
      if(lots <= 0.0)
         return false;
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double sl  = NormalizeDouble(bid + InpStopLossPoints * point, digits);
      double tp  = NormalizeDouble(bid - InpTakeProfitPoints * point, digits);
      ok = g_trade.Sell(lots, _Symbol, 0.0, sl, tp, "USDJPY Scalper SELL");
   }

   if(ok)
   {
      g_lastEntryTime = TimeCurrent();
      g_windowTrades++;
      g_lastSkipReason = "OPENED";
   }
   else
   {
      g_lastSkipReason = "SKIP: order send failed";
   }

   return ok;
}

int OnInit()
{
   g_fastHandle = iMA(_Symbol, InpSignalTimeframe, InpFastEMA, 0, MODE_EMA, PRICE_CLOSE);
   g_slowHandle = iMA(_Symbol, InpSignalTimeframe, InpSlowEMA, 0, MODE_EMA, PRICE_CLOSE);
   g_rsiHandle  = iRSI(_Symbol, InpSignalTimeframe, InpRSIPeriod, PRICE_CLOSE);

   if(g_fastHandle == INVALID_HANDLE || g_slowHandle == INVALID_HANDLE || g_rsiHandle == INVALID_HANDLE)
      return INIT_FAILED;

   ResetDayBaselineIfNeeded();
   ResetWindowIfNeeded();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   if(g_fastHandle != INVALID_HANDLE) IndicatorRelease(g_fastHandle);
   if(g_slowHandle != INVALID_HANDLE) IndicatorRelease(g_slowHandle);
   if(g_rsiHandle  != INVALID_HANDLE) IndicatorRelease(g_rsiHandle);
}

void OnTick()
{
   bool canTrade = true;

   ResetDayBaselineIfNeeded();
   ResetWindowIfNeeded();

   ManageOpenPosition();

   if(!IsWithinSession()) { g_lastSkipReason = "SKIP: out of session"; canTrade = false; }
   if(canTrade && !IsSpreadOk()) { g_lastSkipReason = "SKIP: spread too high"; canTrade = false; }
   if(canTrade && !IsDailyLossOk()) { g_lastSkipReason = "SKIP: daily loss stop"; canTrade = false; }

   datetime nowTs = TimeCurrent();
   if(canTrade && !g_reentryRequested)
   {
      if(g_lastEntryTime > 0 && (int)(nowTs - g_lastEntryTime) < InpMinSecondsBetweenEntries)
      {
         g_lastSkipReason = "SKIP: min entry interval";
         canTrade = false;
      }
   }
   if(canTrade && g_windowTrades >= InpMaxTradesPerWindow)
   {
      g_lastSkipReason = "SKIP: trade window limit";
      canTrade = false;
   }

   if(canTrade && InpOnePositionAtATime && HasAnyOpenPositionOnSymbol())
   {
      g_lastSkipReason = "SKIP: existing symbol position";
      canTrade = false;
   }
   if(canTrade && HasOwnOpenPosition())
   {
      g_lastSkipReason = "SKIP: own position still open";
      canTrade = false;
   }

   if(canTrade)
   {
      SignalType signal = GetSignal();
      if(signal == SIGNAL_NONE && g_reentryRequested && InpReentryWithoutSignal)
      {
         if(g_lastClosedDirection > 0) signal = SIGNAL_BUY;
         if(g_lastClosedDirection < 0) signal = SIGNAL_SELL;
      }
      if(signal == SIGNAL_NONE)
      {
         g_lastSkipReason = "SKIP: no signal";
         canTrade = false;
      }

      if(canTrade && OpenTrade(signal))
         g_reentryRequested = false;
   }

   double spreadPts = (double)SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   Comment("USDJPY_Scalper\n",
           "Last: ", g_lastSkipReason, "\n",
           "SpreadPts: ", DoubleToString(spreadPts, 0), " / Max: ", IntegerToString(InpMaxSpreadPoints), "\n",
           "MarginCap$: ", DoubleToString(InpMaxMarginMoneyPerTrade, 2), "\n",
           "TP$: ", DoubleToString(GetMoneyTakeProfitThreshold(), 2), "  SL$: ", DoubleToString(InpMaxLossMoneyPerTrade, 2), "\n",
           "WindowTrades: ", IntegerToString(g_windowTrades), "/", IntegerToString(InpMaxTradesPerWindow));
}
