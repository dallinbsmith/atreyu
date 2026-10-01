# 0013. No experiments on header, footer or other site chrome

**Status:** Accepted.

## Decision

There is no mechanism to A/B test or personalize the header, footer or other shared chrome. The earlier chrome-experiment registry is deleted.

## Consequences

- Experiments swap the page (`<main>`); Personalize tables swap sections inside it.
- If chrome testing comes back as a requirement, design it as a new decision on top of the plugin, not as a separate mechanism.
