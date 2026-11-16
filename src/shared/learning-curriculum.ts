import type { LearningPathCurriculum, LearningPathGate } from '../../types/learning-path';
import type { CurriculumLayout } from './models/learning-curriculum';

/** Layout edits preserve semantic gate IDs; learning progress is never rewritten. */
export function createCurriculumLayout(base: LearningPathCurriculum): CurriculumLayout {
  return { stages: (base.stages || []).map(stage => ({
    id: stage.id, title: stage.title || '未命名章节',
    gates: (stage.gates || []).map(gate => ({
      id: gate.id, title: gate.title || '未命名关卡',
      kind: gate.kind === 'mixed' || gate.kind === 'challenge' ? gate.kind : 'learning',
      sectionId: gate.sectionId || '', scope: gate.scope || (gate.optional ? 'elective' : 'core'),
      ...(gate.id.startsWith('custom-') ? { description: gate.learningDescription || gate.description || '', goals: [...(gate.goals || [])], topicIds: [...(gate.topicIds || [])] } : {})
    }))
  })) };
}

export function applyCurriculumLayout(base: LearningPathCurriculum, layout: CurriculumLayout): LearningPathCurriculum {
  const originalStages = new Map((base.stages || []).map(stage => [stage.id, stage]));
  const activeIds = new Set(layout.stages.flatMap(stage => stage.gates.map(gate => gate.id)));
  const oldNames = new Map((base.legacyGates || []).map(gate => [gate.id, gate]));
  for (const stage of base.stages || []) {
    for (const gate of stage.gates || []) {
      if (!activeIds.has(gate.id)) oldNames.set(gate.id, { id: gate.id, title: gate.title || gate.id, stageTitle: stage.title || stage.id });
    }
  }
  const stages = layout.stages.map(entry => {
    const original = originalStages.get(entry.id);
    if (!original) throw new Error('课程编排包含未知章节，请重新同步');
    const gatesById = new Map((original.gates || []).map(gate => [gate.id, gate]));
    const sections = new Map((original.sections || []).map(section => [section.id, section]));
    const gates: LearningPathGate[] = entry.gates.map(item => {
      const previous = gatesById.get(item.id), section = sections.get(item.sectionId);
      return {
        ...(previous || { id: item.id, description: item.description || '', learningDescription: item.description || '', goals: [...(item.goals || [])], topicIds: [...(item.topicIds || [])], threadGateIds: [], prerequisites: { gateIds: [], topicIds: [] } }),
        title: item.title, kind: item.kind, sectionId: item.sectionId,
        sectionTitle: section?.title, scope: item.scope, optional: item.scope !== 'core',
        routeId: section?.routeId || null,
        prerequisites: previous?.prerequisites ? { ...previous.prerequisites, gateIds: (previous.prerequisites.gateIds || []).filter(id => activeIds.has(id)) } : { gateIds: [], topicIds: [] },
        threadGateIds: (previous?.threadGateIds || []).filter(id => activeIds.has(id))
      };
    });
    return {
      ...original, title: entry.title, gates,
      sections: (original.sections || []).map(section => ({
        ...section, gateIds: gates.filter(gate => gate.sectionId === section.id).map(gate => gate.id),
        prerequisites: section.prerequisites ? { ...section.prerequisites, gateIds: (section.prerequisites.gateIds || []).filter(id => activeIds.has(id)) } : undefined
      })).filter(section => section.gateIds.length > 0)
    };
  });
  return { ...base, stages, legacyGates: [...oldNames.values()] };
}
