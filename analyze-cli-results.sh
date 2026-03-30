#!/bin/bash
# Quick CLI benchmark result analyzer

RESULT_FILE=$(ls -t results/*.json | head -1)

echo "📊 CLI BENCHMARK RESULTS"
echo "======================="
echo ""
echo "Result file: $RESULT_FILE"
echo ""

# Extract summary using jq
echo "🏆 RANKINGS:"
cat "$RESULT_FILE" | jq -r '
  .summary 
  | to_entries 
  | sort_by(-.value.avg_total) 
  | .[] 
  | "\(.key): \(.value.avg_total)/10 (Acc: \(.value.avg_accuracy), Comp: \(.value.avg_completeness), Wins: \(.value.wins)/5)"
'

echo ""
echo "⚡ SPEED:"
cat "$RESULT_FILE" | jq -r '
  .summary 
  | to_entries 
  | sort_by(.value.avg_latency_ms) 
  | .[] 
  | "\(.key): \(.value.avg_latency_ms / 1000 | floor)s avg"
'

echo ""
echo "📈 PER-CASE WINNERS:"
cat "$RESULT_FILE" | jq -r '
  .results 
  | group_by(.case_id) 
  | .[] 
  | {
      case: .[0].case_id,
      winner: (sort_by(-.scores.total) | .[0] | {model: .model_id, score: .scores.total})
    }
  | "\(.case): \(.winner.model) (\(.winner.score)/10)"
'

echo ""
echo "💡 INSIGHTS:"
echo "- Top model: $(cat "$RESULT_FILE" | jq -r '.summary | to_entries | sort_by(-.value.avg_total) | .[0].key')"
echo "- Fastest: $(cat "$RESULT_FILE" | jq -r '.summary | to_entries | sort_by(.value.avg_latency_ms) | .[0].key')"
echo "- Most wins: $(cat "$RESULT_FILE" | jq -r '.summary | to_entries | sort_by(-.value.wins) | .[0].key')"

echo ""
echo "📁 Full results: $RESULT_FILE"
