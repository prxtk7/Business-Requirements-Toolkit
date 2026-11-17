import { Badge } from '../../components/ui/Badge';
import { STRATEGY_DETAILS, type EngagementStrategy } from '../../domain/stakeholders';
import { STRATEGY_STYLE } from './strategyStyles';

export function StrategyBadge({ strategy }: { strategy: EngagementStrategy }) {
  return <Badge tone={STRATEGY_STYLE[strategy].badge}>{STRATEGY_DETAILS[strategy].label}</Badge>;
}
