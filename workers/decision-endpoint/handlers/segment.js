// Coarse firmographic segmentation from a Clearbit Reveal response.
// Deliberately tiny — P0-44 says "keep the grammar tiny or hardcode two/three
// segments," so this is two: 'enterprise' / 'default'. Dropping the
// spike/edge/segment.js INDUSTRY_GROUP_1/2 sub-industry refinement since both
// were empty stub arrays there (dead code) and the plan explicitly asks for
// tiny, not faithful, here. Revisit if a real sub-industry list ever lands.
//
// Threshold corrected 2026-06-25 (Philomena Block DM): real production reality
// is enterprise at 100+ employees, not 1000. The 1000 value ported in from
// spike/edge/segment.js was wrong against production. "100+" is inclusive, so
// this uses `>=` (a company with exactly 100 employees IS enterprise) — a
// deliberate divergence from the ported code's strict `>` idiom.
export const DEFAULT_SEGMENT = 'default';
export const ENTERPRISE_SEGMENT = 'enterprise';
const ENTERPRISE_EMPLOYEE_THRESHOLD = 100;

const employeeCount = (reveal) => reveal?.company?.metrics?.employees ?? 0;

export const deriveSegment = (reveal) => (employeeCount(reveal) >= ENTERPRISE_EMPLOYEE_THRESHOLD
  ? ENTERPRISE_SEGMENT
  : DEFAULT_SEGMENT);
