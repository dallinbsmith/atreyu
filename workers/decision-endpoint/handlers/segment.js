// Coarse firmographic segmentation from a Clearbit Reveal response.
// Deliberately tiny — P0-44 says "keep the grammar tiny or hardcode two/three
// segments," so this is two: 'enterprise' / 'default'. Threshold is ported
// from spike/edge/segment.js's isEnterprise() (itself a port of Falkor's
// web/src/utils/reveal.ts getHasEnterpriseEmployeeCount()), dropping that
// file's INDUSTRY_GROUP_1/2 sub-industry refinement since both were empty
// stub arrays there (dead code) and the plan explicitly asks for tiny, not
// faithful, here. Revisit if a real sub-industry list ever lands.

export const DEFAULT_SEGMENT = 'default';
export const ENTERPRISE_SEGMENT = 'enterprise';
const ENTERPRISE_EMPLOYEE_THRESHOLD = 1000;

const employeeCount = (reveal) => reveal?.company?.metrics?.employees ?? 0;

export const deriveSegment = (reveal) => (employeeCount(reveal) > ENTERPRISE_EMPLOYEE_THRESHOLD
  ? ENTERPRISE_SEGMENT
  : DEFAULT_SEGMENT);
