package
{
   import com.midasplayer.debug.DebugLog;
   import com.midasplayer.engine.DebugMain;
   import com.midasplayer.engine.GameMain;
   import com.midasplayer.engine.comm.DebugGameComm;
   import com.midasplayer.engine.comm.GameComm;
   import com.midasplayer.games.candycrush.EngineFactory;
   import com.midasplayer.engine.Engine;
   import com.midasplayer.engine.IEngine;
   import com.midasplayer.engine.IEngineFactory;
   import com.midasplayer.games.candycrush.ItemType;
   import com.midasplayer.games.candycrush.Logic;
   import com.midasplayer.games.candycrush.ScoreHolder;
   import com.midasplayer.games.candycrush.board.Board;
   import com.midasplayer.games.candycrush.board.Item;
   import com.midasplayer.time.ITimer;
   import flash.events.Event;
   import flash.external.ExternalInterface;
   import com.midasplayer.games.candycrush.ReplayEngineFactory;
   import com.midasplayer.time.AdjustableTimer;
   import com.midasplayer.time.ITimer;
   import com.midasplayer.time.SystemTimer;
   import flash.display.Sprite;
   
   [SWF(width="755", height="600", backgroundColor="#000000", frameRate="60")]
   public class Main extends Sprite
   {
      
      private static var mainSeed:int;
      
      private static const _testGameData:String = "<gamedata randomseed=\"123456\" version=\"1\">" + "   <musicOn>false</musicOn>" + "   <soundOn>true</soundOn>" + "   <isShortGame>false</isShortGame>" + "   <booster_1>0</booster_1>" + "   <booster_2>0</booster_2>" + "   <booster_3>0</booster_3>" + "   <booster_4>0</booster_4>" + "   <booster_5>0</booster_5>" + "   <bestScore>100</bestScore>" + "   <bestChain>2</bestChain>" + "   <bestLevel>1</bestLevel>" + "   <bestCrushed>5</bestCrushed>" + "   <bestMixed>2</bestMixed>" + "\t<text id=\"intro.time\">The game begins in {0} Second</text>" + "\t<text id=\"intro.title\">Play as follows:</text>" + "\t<text id=\"intro.info1\">Match 3 Candy of the same colour to crush them. Matching 4 or 5 in different formations generates special sweets that are extra tasty</text>" + "\t<text id=\"intro.info2\">You can also combine the power candy for additional effects by switching them with each other, so if you have time left you may want to save the best sweets for later.Try these combinations for  a taste you will not forget: Extra rad 1.</text>" + "\t<text id=\"game.nomoves\">No more moves!</text>" + "\t<text id=\"outro.opengame\">Please register to play the full game</text>" + "\t<text id=\"outro.title\">Game Over</text>" + "\t<text id=\"outro.now\">now</text>" + "\t<text id=\"outro.bestever\">best ever</text>" + "\t<text id=\"outro.score\">Score</text>" + "\t<text id=\"outro.chain\">Longest chain</text>" + "\t<text id=\"outro.level\">Level reached</text>" + "\t<text id=\"outro.crushed\">Candy crushed</text>" + "\t<text id=\"outro.time\">Game ends in {0} seconds</text>" + "\t<text id=\"outro.trophy.one\">crushed {0} candy in one game</text>" + "\t<text id=\"outro.trophy.two\">scored {0} in one game</text>" + "\t<text id=\"outro.trophy.three\">made {0} combined candy in one game</text>" + "\t<text id=\"outro.combo_wrapper_line\">combo wrapper line description</text>" + "\t<text id=\"outro.combo_color_color\">combo color color description</text>" + "\t<text id=\"outro.combo_color_line\">combo color line description</text>" + "\t<text id=\"outro.combo_color_wrapper\">combo color wrapper description. very long description yes yes.</text>" + "</gamedata>";
      
      public static const Log:DebugLog = new DebugLog(30);
      
      private var _bestScore:int;
      
      public function Main()
      {
         var _loc1_:String = null;
         super();
         // CrushBench: the host page supplies <gamedata> via getGameData() (seed, options);
         // without a host we fall back to the embedded test data with a random seed.
         if(GameComm.isAvailable())
         {
            _loc1_ = new GameComm().getGameData();
         }
         else
         {
            mainSeed = 1 + Math.random() * 999999;
            _loc1_ = _getTestGameData(mainSeed);
         }
         _applyBenchOptions(_loc1_);
         timer = new ManualTimer();
         var _loc2_:EngineFactory = new EngineFactory(GameComm.isAvailable() ? new GameComm() : new DebugGameComm(_loc1_),timer);
         _benchMain = new BenchMain(_loc2_);
         addChild(_benchMain);
         addEventListener(Event.ENTER_FRAME,_onBenchFrame);
      }
      
      private static var _benchMain:BenchMain;
      
      /** The engine is created when BenchMain hits the stage; pick it up then. */
      private function _onBenchFrame(param1:Event) : void
      {
         if(ensureEngine())
         {
            removeEventListener(Event.ENTER_FRAME,_onBenchFrame);
         }
      }
      
      public static function ensureEngine() : Boolean
      {
         if(engine == null && _benchMain != null)
         {
            engine = _benchMain.getEngine();
         }
         if(engine != null)
         {
            install();
         }
         return engine != null;
      }
      
      /** Optional <timeLimitSeconds> in the gamedata overrides the 240s default. */
      private static function _applyBenchOptions(param1:String) : void
      {
         var _loc2_:XML = null;
         var _loc3_:XMLList = null;
         try
         {
            _loc2_ = new XML(param1);
            _loc3_ = _loc2_.child("timeLimitSeconds");
            if(_loc3_.length() == 1 && parseInt(_loc3_.text()) > 0)
            {
               Logic.SecondsTimeLimit = parseInt(_loc3_.text());
            }
         }
         catch(e:Error)
         {
         }
      }
      
      // =====================================================================
      // CrushBench bridge
      //
      // The host page drives the game through ExternalInterface callbacks.
      // The engine runs on a ManualTimer, so nothing happens between calls:
      // the game is turn-based and deterministic for a given randomseed.
      // Grid coordinates are (x, y): x = column 0..8 left-to-right,
      // y = row 0..8 top-to-bottom, matching Board's own indexing.
      // =====================================================================

      /** Must equal Ticker's int(1000 / Ticks.TicksPerSecond). */
      public static const TICK_MS:int = 33;

      /** Created lazily: script-private classes initialise after Main's statics. */
      public static var timer:ManualTimer;

      public static var engine:IEngine;

      public static var logic:Logic;

      /** When true GameView.tickHint() is a no-op, so screenshots never leak hints. */
      public static var hintsDisabled:Boolean = true;

      public static var installed:Boolean = false;

      public static function install() : void
      {
         if(installed || !ExternalInterface.available)
         {
            return;
         }
         installed = true;
         ExternalInterface.addCallback("cb_ping",ping);
         ExternalInterface.addCallback("cb_getState",getStateJson);
         ExternalInterface.addCallback("cb_advance",advance);
         ExternalInterface.addCallback("cb_settle",settleJson);
         ExternalInterface.addCallback("cb_swap",swapJson);
         ExternalInterface.addCallback("cb_legalMoves",legalMovesJson);
         ExternalInterface.addCallback("cb_isLegal",isLegalMove);
         ExternalInterface.addCallback("cb_setHints",setHints);
      }

      public static function ping() : String
      {
         return "pong";
      }

      public static function setHints(param1:Boolean) : void
      {
         hintsDisabled = !param1;
      }

      // ---- clock -------------------------------------------------------------

      /** Run exactly n engine ticks. Returns how many actually ran. */
      public static function advance(param1:int) : int
      {
         var _loc2_:int = 0;
         ensureEngine();
         while(_loc2_ < param1)
         {
            if(engine == null || engine.isDone())
            {
               break;
            }
            timer.time += TICK_MS;
            engine.update();
            _loc2_++;
         }
         return _loc2_;
      }

      /** True when the game is waiting for a move: in play, unpaused, board at rest. */
      public static function isReady() : Boolean
      {
         if(engine == null || logic == null)
         {
            return false;
         }
         if(engine.isDone())
         {
            return false;
         }
         if((engine as Engine).getState() != Engine.GameState)
         {
            return false;
         }
         if(logic.isDone() || logic.isPaused())
         {
            return false;
         }
         return logic.getBoard().isStable();
      }

      /** Tick until isReady() or the game ends. Returns ticks used. */
      public static function settle(param1:int = 3000) : int
      {
         var _loc2_:int = 0;
         // Always take at least one tick so a just-issued swap begins moving;
         // Board.isStable() is only recomputed inside Board.tick().
         while(_loc2_ < param1)
         {
            if(engine == null || engine.isDone())
            {
               break;
            }
            if(_loc2_ > 0 && (isReady() || logic == null || logic.isDone()))
            {
               break;
            }
            advance(1);
            _loc2_++;
         }
         return _loc2_;
      }

      public static function settleJson(param1:int = 3000) : String
      {
         var _loc2_:int = settle(param1);
         return "{\"ticks\":" + _loc2_ + ",\"state\":" + getStateJson() + "}";
      }

      // ---- state -------------------------------------------------------------

      public static function getStateJson() : String
      {
         var _loc5_:int = 0;
         var _loc6_:int = 0;
         var _loc7_:Item = null;
         var _loc8_:Array = null;
         ensureEngine();
         if(logic == null || engine == null)
         {
            return "{\"phase\":\"loading\"}";
         }
         var _loc1_:Board = logic.getBoard();
         var _loc2_:ScoreHolder = logic.getScoreHolder();
         var _loc3_:int = (engine as Engine).getState();
         var _loc4_:Array = [];
         _loc6_ = 0;
         while(_loc6_ < _loc1_.height())
         {
            _loc8_ = [];
            _loc5_ = 0;
            while(_loc5_ < _loc1_.width())
            {
               _loc7_ = _loc1_.getGridItem(_loc5_,_loc6_);
               if(_loc7_ == null)
               {
                  _loc8_.push("null");
               }
               else
               {
                  _loc8_.push("[" + _loc7_.color + "," + _loc7_.special + "]");
               }
               _loc5_++;
            }
            _loc4_.push("[" + _loc8_.join(",") + "]");
            _loc6_++;
         }
         var _loc9_:String = _loc3_ == Engine.IntroState ? "intro" : (_loc3_ == Engine.GameState ? "game" : (_loc3_ == Engine.OutroState ? "outro" : (_loc3_ == Engine.DoneState ? "done" : "notstarted")));
         return "{" +
            "\"phase\":\"" + _loc9_ + "\"," +
            "\"ready\":" + isReady() + "," +
            "\"done\":" + (logic.isDone() || engine.isDone()) + "," +
            "\"paused\":" + logic.isPaused() + "," +
            "\"stable\":" + _loc1_.isStable() + "," +
            "\"level\":" + logic.getHumanReadableLevel() + "," +
            "\"score\":" + logic.getScore() + "," +
            "\"levelScore\":" + _loc2_.getLevelScore() + "," +
            "\"levelRemoved\":" + _loc2_.getLevelRemoveItemCount() + "," +
            "\"levelTarget\":" + ScoreHolder.getLevelItemLimit(_loc2_.getLevel()) + "," +
            "\"ticksLeft\":" + logic.getTicksLeft() + "," +
            "\"levelTicks\":" + logic._levelTicks + "," +
            "\"time\":" + timer.time + "," +
            "\"movesLeft\":" + _loc1_.isPossibleMovesLeft() + "," +
            "\"width\":" + _loc1_.width() + "," +
            "\"height\":" + _loc1_.height() + "," +
            "\"board\":[" + _loc4_.join(",") + "]" +
            "}";
      }

      // ---- moves -------------------------------------------------------------

      /**
       * Mirrors Board.trySwap + Board.isSwapReaction + ItemFactory.categorizeAndHandleSwap:
       * a swap "does something" if both candies are special, either is a colour bomb,
       * or the swap creates a 3+ line through either swapped cell.
       */
      public static function isLegalMove(param1:int, param2:int, param3:int, param4:int) : Boolean
      {
         if(logic == null)
         {
            return false;
         }
         var _loc5_:Board = logic.getBoard();
         if(!(param1 == param3 && Math.abs(param2 - param4) == 1 || param2 == param4 && Math.abs(param1 - param3) == 1))
         {
            return false;
         }
         var _loc6_:Item = _loc5_.getGridItem(param1,param2);
         var _loc7_:Item = _loc5_.getGridItem(param3,param4);
         if(_loc6_ == null || _loc7_ == null)
         {
            return false;
         }
         if(_loc6_.special != 0 && _loc7_.special != 0)
         {
            return true;
         }
         if(ItemType.isColor(_loc6_.special) || ItemType.isColor(_loc7_.special))
         {
            return true;
         }
         var _loc8_:Array = colorGrid(_loc5_);
         var _loc9_:int = _loc8_[param2][param1];
         _loc8_[param2][param1] = _loc8_[param4][param3];
         _loc8_[param4][param3] = _loc9_;
         return lineThrough(_loc8_,param1,param2) || lineThrough(_loc8_,param3,param4);
      }

      /** Matchable colour per cell (0 = cannot be matched), rows of columns like Board._mInt. */
      private static function colorGrid(param1:Board) : Array
      {
         var _loc3_:int = 0;
         var _loc4_:Array = null;
         var _loc5_:Item = null;
         var _loc2_:Array = [];
         var _loc6_:int = 0;
         while(_loc6_ < param1.height())
         {
            _loc4_ = [];
            _loc3_ = 0;
            while(_loc3_ < param1.width())
            {
               _loc5_ = param1.getGridItem(_loc3_,_loc6_);
               _loc4_.push(_loc5_ != null && _loc5_.canBeMatched() ? _loc5_.color : 0);
               _loc3_++;
            }
            _loc2_.push(_loc4_);
            _loc6_++;
         }
         return _loc2_;
      }

      private static function lineThrough(param1:Array, param2:int, param3:int) : Boolean
      {
         var _loc4_:int = param1[param3][param2];
         if(_loc4_ == 0)
         {
            return false;
         }
         var _loc5_:int = param1.length;
         var _loc6_:int = param1[0].length;
         var _loc7_:int = 1;
         var _loc8_:int = param2 - 1;
         while(_loc8_ >= 0 && param1[param3][_loc8_] == _loc4_)
         {
            _loc7_++;
            _loc8_--;
         }
         _loc8_ = param2 + 1;
         while(_loc8_ < _loc6_ && param1[param3][_loc8_] == _loc4_)
         {
            _loc7_++;
            _loc8_++;
         }
         if(_loc7_ >= 3)
         {
            return true;
         }
         _loc7_ = 1;
         var _loc9_:int = param3 - 1;
         while(_loc9_ >= 0 && param1[_loc9_][param2] == _loc4_)
         {
            _loc7_++;
            _loc9_--;
         }
         _loc9_ = param3 + 1;
         while(_loc9_ < _loc5_ && param1[_loc9_][param2] == _loc4_)
         {
            _loc7_++;
            _loc9_++;
         }
         return _loc7_ >= 3;
      }

      public static function legalMovesJson() : String
      {
         var _loc3_:int = 0;
         var _loc1_:Array = [];
         if(logic == null)
         {
            return "[]";
         }
         var _loc2_:Board = logic.getBoard();
         var _loc4_:int = 0;
         while(_loc4_ < _loc2_.height())
         {
            _loc3_ = 0;
            while(_loc3_ < _loc2_.width())
            {
               if(_loc3_ + 1 < _loc2_.width() && isLegalMove(_loc3_,_loc4_,_loc3_ + 1,_loc4_))
               {
                  _loc1_.push("[" + _loc3_ + "," + _loc4_ + "," + (_loc3_ + 1) + "," + _loc4_ + "]");
               }
               if(_loc4_ + 1 < _loc2_.height() && isLegalMove(_loc3_,_loc4_,_loc3_,_loc4_ + 1))
               {
                  _loc1_.push("[" + _loc3_ + "," + _loc4_ + "," + _loc3_ + "," + (_loc4_ + 1) + "]");
               }
               _loc3_++;
            }
            _loc4_++;
         }
         return "[" + _loc1_.join(",") + "]";
      }

      /**
       * Settle, attempt the swap via the real Board.trySwap, then settle again.
       * Illegal swaps are still sent to the game (it animates the swap-back),
       * exactly as if a human had dragged it.
       */
      public static function swapJson(param1:int, param2:int, param3:int, param4:int) : String
      {
         var _loc5_:int = settle();
         if(logic == null)
         {
            return "{\"error\":\"not loaded\"}";
         }
         var _loc6_:Boolean = isReady();
         var _loc7_:Boolean = isLegalMove(param1,param2,param3,param4);
         var _loc8_:int = logic.getScore();
         var _loc9_:int = logic.getHumanReadableLevel();
         var _loc10_:Boolean = false;
         if(_loc6_)
         {
            _loc10_ = logic.getBoard().trySwap(param1,param2,param3,param4);
         }
         var _loc11_:int = _loc10_ ? settle() : 0;
         return "{" +
            "\"accepted\":" + _loc10_ + "," +
            "\"legal\":" + _loc7_ + "," +
            "\"scoreBefore\":" + _loc8_ + "," +
            "\"scoreDelta\":" + (logic.getScore() - _loc8_) + "," +
            "\"levelBefore\":" + _loc9_ + "," +
            "\"ticks\":" + (_loc5_ + _loc11_) + "," +
            "\"state\":" + getStateJson() +
            "}";
      }

      public static function canBotBeActive() : Boolean
      {
         return false;
      }
      
      public static function configTimer(param1:ITimer) : void
      {
      }
      
      public static function emitPlayData(param1:int, param2:String) : void
      {
      }
      
      public static function _getTestGameData(param1:int) : String
      {
         return _testGameData.replace("123456",param1.toString());
      }
   }
}

import com.midasplayer.engine.GameMain;
import com.midasplayer.engine.IEngine;
import com.midasplayer.engine.IEngineFactory;
import com.midasplayer.time.ITimer;

/** GameMain that hands the engine to the bridge once it exists. */
class BenchMain extends GameMain
{
   public function BenchMain(param1:IEngineFactory)
   {
      super(param1);
   }
   
   public function getEngine() : IEngine
   {
      return _engine;
   }
}

/** A clock that only moves when the bridge says so. */
class ManualTimer implements ITimer
{
   public var time:int = 0;
   
   public function ManualTimer()
   {
      super();
   }
   
   public function getTime() : int
   {
      return this.time;
   }
}
