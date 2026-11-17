import type { ProcessStep } from '../../domain/types';

/** Select option for a process step, numbered by its position. */
export function stepOption(step: ProcessStep, index: number) {
  return { value: step.id, label: `${index + 1}. ${step.name}` };
}
