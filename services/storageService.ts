import { HistoryItem, TranslationResult } from '../types';

const STORAGE_KEY = 'cms_auditor_history_v1';

const SEED_EXAMPLES: HistoryItem[] = [
  {
    id: 'seed-1',
    timestamp: Date.now() - 100000,
    tags: ['Mobility', 'K0001'],
    input: "Patient is 78yo female, severe OA in knees. Can't walk to bathroom safely anymore. Hands are too weak for a standard walker. Needs something with wheels and a seat.",
    result: {
      text: `**Recommended HCPCS Code:** K0001 (Standard Manual Wheelchair)

**CMS-Compliant Clinical Documentation:**
The beneficiary presents with a significant mobility limitation that significantly impairs their ability to participate in one or more mobility-related activities of daily living (MRADLs), specifically toileting, in the customary locations of the home. The patient has a diagnosis of severe osteoarthritis in the bilateral knees, preventing safe ambulation to the bathroom. Use of an appropriately fitted cane or walker has been considered and ruled out; the patient exhibits insufficient upper extremity strength to safely manipulate a standard walker, and these devices do not resolve the mobility deficit. The beneficiary demonstrates the physical and cognitive ability to safely operate a manual wheelchair. A standard manual wheelchair is medically necessary to facilitate MRADLs in the home.

**CMS Compliance Checklist:**
- [x] Mobility limitation significantly impairs MRADLs in the home
- [x] Mobility deficit cannot be resolved with a cane or walker
- [x] Patient has physical/mental ability to operate the manual wheelchair
- [x] Equipment is required for use in the home

**Missing/Required Information:**
None.`
    }
  },
  {
    id: 'seed-2',
    timestamp: Date.now() - 200000,
    tags: ['Respiratory', 'E1390'],
    input: "Mr. Jones has COPD. O2 sats are dropping to 85% when he walks around the house. On room air at rest he is 88%. He needs home oxygen.",
    result: {
      text: `**Recommended HCPCS Code:** E1390 (Oxygen Concentrator)

**CMS-Compliant Clinical Documentation:**
The beneficiary has a severe lung disease, specifically Chronic Obstructive Pulmonary Disease (COPD), which constitutes a qualifying medical condition. Testing performed while the patient was in a chronic stable state, not during an acute illness or exacerbation, demonstrates hypoxemia. An arterial blood gas study or pulse oximetry performed at rest on room air yielded a result of 88%, meeting Group I criteria (saturation at or below 88%). Furthermore, the patient exhibits desaturation to 85% during ambulation within the home. The patient has been educated on the use of the equipment and is capable of using it safely. Alternative treatments have been considered and deemed ineffective.

**CMS Compliance Checklist:**
- [x] Diagnosis of severe lung disease
- [x] Qualifying blood gas/saturation study (Group I criteria met: ≤88% at rest)
- [x] Testing performed in chronic stable state
- [x] Alternative treatments ruled out

**Missing/Required Information:**
None.`
    }
  },
  {
    id: 'seed-3',
    timestamp: Date.now() - 300000,
    tags: ['ADL', 'E0260'],
    input: "Patient is bedbound due to severe stroke. Needs a hospital bed because they can't sleep flat due to aspiration risk and needs head elevated 45 degrees.",
    result: {
      text: `**Recommended HCPCS Code:** E0260 (Semi-Electric Hospital Bed)

**CMS-Compliant Clinical Documentation:**
The beneficiary requires a hospital bed for use in the home to treat a medical condition, specifically sequelae of a severe stroke resulting in a bedbound status. The patient strictly requires positioning of the body in ways not feasible with an ordinary bed to alleviate pain and prevent aspiration. Specifically, the patient's condition necessitates elevation of the head of the bed to 45 degrees or more due to a high risk of aspiration. An ordinary bed cannot be modified to meet these medical needs. The patient requires frequent changes in body position which cannot be managed with a fixed-height bed.

**CMS Compliance Checklist:**
- [x] Patient requires positioning not feasible in an ordinary bed
- [x] Condition requires head elevation > 30 degrees (Aspiration risk cited)
- [x] Equipment is for use in the home

**Missing/Required Information:**
None.`
    }
  }
];

export const getHistory = (): HistoryItem[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    // Seed initial data if empty
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_EXAMPLES));
    return SEED_EXAMPLES;
  }
  return JSON.parse(stored);
};

export const saveToHistory = (input: string, result: TranslationResult, tags: string[] = []): HistoryItem => {
  const current = getHistory();
  const newItem: HistoryItem = {
    id: Date.now().toString(),
    timestamp: Date.now(),
    input,
    result,
    tags
  };
  const updated = [newItem, ...current];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newItem;
};

export const clearHistory = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const deleteHistoryItem = (id: string) => {
  const current = getHistory();
  const updated = current.filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};