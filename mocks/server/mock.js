import http from 'node:http'
import { URL } from 'node:url'
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001

// ---- DATA DE PRUEBA ----
const flowsCatalog = {
  flows: [
    {
      id: 'RampFlow',
      title: 'Accesibility Audit - Ramps',
      version: 'v1.0',
      description: 'Check ramp accessibility according to ADA standards',
      stepsCount: 30,
    },
  ],
}

const flowDetail = {
  flowId: 'RampAccessibilityVerification',
  title: 'Ramp Accessibility Verification',
  version: 'v1.0',
  steps: [
    {
      id: 'Q01',
      type: 'Question',
      text: 'Is the ramp located on an accessible route?',
      yesNext: 'Q02',
      noNext: 'F01',
    },
    {
      id: 'F01',
      type: 'Form',
      title: 'Location and Route - Data Input',
      fields: [
        { id: 'photo', type: 'photo', label: 'Upload photo (optional)' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
        { id: 'quantity', type: 'number', label: 'Number of ramps' },
      ],
      next: 'Q02',
    },
    {
      id: 'Q02',
      type: 'Question',
      text: 'Is the running slope ≤ 8.3%?',
      yesNext: 'Q03',
      noNext: 'F02',
    },
    {
      id: 'F02',
      type: 'Form',
      title: 'Running Slope - Data Input',
      fields: [
        { id: 'measurements', type: 'number', label: 'Maximum slope (%)' },
        { id: 'photo', type: 'photo', label: 'Upload photo (optional)' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q03',
    },
    {
      id: 'Q03',
      type: 'Question',
      text: 'Is the cross slope ≤ 2%?',
      yesNext: 'Q04',
      noNext: 'F03',
    },
    {
      id: 'F03',
      type: 'Form',
      title: 'Cross Slope - Data Input',
      fields: [
        { id: 'measurements', type: 'number', label: 'Maximum slope (%)' },
        { id: 'photo', type: 'photo', label: 'Upload photo (optional)' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q04',
    },
    {
      id: 'Q04',
      type: 'Question',
      text: 'Is the slope of all landings ≤ 2% in all directions?',
      yesNext: 'Q05',
      noNext: 'F04',
    },
    {
      id: 'F04',
      type: 'Form',
      title: 'Landing Slope - Data Input',
      fields: [
        { id: 'measurements', type: 'number', label: 'Maximum slope (%)' },
        { id: 'photo', type: 'photo', label: 'Upload photo (optional)' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q05',
    },
    {
      id: 'Q05',
      type: 'Question',
      text: 'Are all landings ≥ 60" long in the direction of the ramp run?',
      yesNext: 'Q06',
      noNext: 'F05',
    },
    {
      id: 'F05',
      type: 'Form',
      title: 'Landing Length - Data Input',
      fields: [
        { id: 'measurements', type: 'number', label: 'Minimum clearance (inches)' },
        { id: 'photo', type: 'photo', label: 'Upload photo (optional)' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q06',
    },
    {
      id: 'Q06',
      type: 'Question',
      text: 'Is the width of all landings at least as wide as the ramp run?',
      yesNext: 'Q07',
      noNext: 'F06',
    },
    {
      id: 'F06',
      type: 'Form',
      title: 'Landing Width - Data Input',
      fields: [
        { id: 'measurements', type: 'number', label: 'Minimum clearance (inches)' },
        { id: 'photo', type: 'photo', label: 'Upload photo (optional)' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q07',
    },
    {
      id: 'Q07',
      type: 'Question',
      text: 'Does the ramp change direction?',
      yesNext: 'Q08',
      noNext: 'Q09',
    },
    {
      id: 'Q08',
      type: 'Question',
      text: 'Are all landings at changes in direction > 60" x 60"?',
      yesNext: 'Q09',
      noNext: 'F08',
    },
    {
      id: 'F08',
      type: 'Form',
      title: 'Landing Dimensions - Data Input',
      fields: [
        { id: 'measurements', type: 'text', label: 'Minimum dimensions' },
        { id: 'photo', type: 'photo', label: 'Upload photo (optional)' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q09',
    },
    {
      id: 'Q09',
      type: 'Question',
      text: 'Does each ramp run have a rise ≤ 30"?',
      yesNext: 'Q10',
      noNext: 'F09',
    },
    {
      id: 'F09',
      type: 'Form',
      title: 'Ramp Run Rise - Data Input',
      fields: [
        { id: 'measurements', type: 'number', label: 'Maximum rise (inches)' },
        { id: 'photo', type: 'photo', label: 'Upload photo (optional)' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q10',
    },
    {
      id: 'Q10',
      type: 'Question',
      text: 'Is the ramp clear width > 36" (measured between handrails)?',
      yesNext: 'Q11',
      noNext: 'F10',
    },
    {
      id: 'F10',
      type: 'Form',
      title: 'Ramp Clear Width - Data Input',
      fields: [
        { id: 'measurements', type: 'number', label: 'Minimum clearance (inches)' },
        { id: 'photo', type: 'photo', label: 'Upload photo (optional)' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
        { id: 'quantity', type: 'number', label: 'Number of ramps' },
      ],
      next: 'Q11',
    },
    {
      id: 'Q11',
      type: 'Question',
      text: 'Is the surface stable, firm, and slip-resistant?',
      yesNext: 'Q12',
      noNext: 'F11',
    },
    {
      id: 'F11',
      type: 'Form',
      title: 'Surface Condition - Data Input',
      fields: [
        { id: 'photo', type: 'photo', label: 'Upload photo (optional)' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
        { id: 'quantity', type: 'number', label: 'Quantity' },
      ],
      next: 'Q12',
    },
    {
      id: 'Q12',
      type: 'Question',
      text: 'Are the ramp transitions free of changes in level > 1/4"?',
      yesNext: 'Q13',
      noNext: 'F12',
    },
    {
      id: 'F12',
      type: 'Form',
      title: 'Level Transitions - Data Input',
      fields: [
        { id: 'measurements', type: 'number', label: 'Maximum change in level (inches)' },
        { id: 'photo', type: 'photo', label: 'Upload photo (optional)' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
        { id: 'quantity', type: 'number', label: 'Number of transitions' },
      ],
      next: 'Q13',
    },
    {
      id: 'Q13',
      type: 'Question',
      text: 'Select one of the following edge protections:',
      options: [
        'Between two walls',
        'CURB or BARRIER',
        'EXTENDED FLOOR',
        'Not Provided / Not Continuous',
      ],
      yesNext: 'Q14',
      noNext: 'Q15',
    },
    {
      id: 'Q14',
      type: 'Question',
      text: 'Is a curb or barrier provided that prevents the passage of a 4" sphere?',
      yesNext: 'F14YES',
      noNext: 'F14NO',
    },
    {
      id: 'F14YES',
      type: 'Form',
      title: 'Curb/Barrier Verification - YES Data Input',
      fields: [
        { id: 'quantity', type: 'number', label: 'Linear feet' },
        { id: 'measurements', type: 'number', label: 'Inches' },
        { id: 'photo', type: 'photo', label: 'Upload photo (optional)' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q15',
    },
    {
      id: 'F14NO',
      type: 'Form',
      title: 'Curb/Barrier Verification - NO Data Input',
      fields: [
        { id: 'measurements', type: 'number', label: 'Maximum dimension (inches)' },
        { id: 'photo', type: 'photo', label: 'Upload photo (optional)' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q15',
    },
    {
      id: 'Q15',
      type: 'Question',
      text: 'Is the ramp rise > 6"?',
      yesNext: 'Q16',
      noNext: 'Q17',
    },
    {
      id: 'Q16',
      type: 'Question',
      text: 'Handrail condition: Select one',
      options: ['On both sides of the ramp', 'On one side of the ramp', 'No handrails provided'],
      yesNext: 'Q17',
      noNext: 'F16',
    },
    {
      id: 'F16',
      type: 'Form',
      title: 'Handrail - No Handrails Provided',
      fields: [
        { id: 'photo', type: 'photo', label: 'Upload photo (optional)' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q17',
    },
    {
      id: 'Q17',
      type: 'Question',
      text: 'Are the handrails 34"-38" AFF?',
      yesNext: 'Q18',
      noNext: 'F17',
    },
    {
      id: 'F17',
      type: 'Form',
      title: 'Handrail Height - Data Input',
      fields: [
        { id: 'measurements', type: 'number', label: 'Handrail height (inches)' },
        { id: 'photo', type: 'photo', label: 'Upload photo (optional)' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q18',
    },
    {
      id: 'Q18',
      type: 'Question',
      text: 'Are the handrails continuous within the full length of each ramp run?',
      yesNext: 'Q19',
      noNext: 'F18',
    },
    {
      id: 'F18',
      type: 'Form',
      title: 'Handrail Continuity - Data Input',
      fields: [
        { id: 'photo', type: 'photo', label: 'Upload photo (optional)' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q19',
    },
    {
      id: 'Q19',
      type: 'Question',
      text: 'Is the inside handrail continuous?',
      yesNext: 'Q20',
      noNext: 'F19',
    },
    {
      id: 'F19',
      type: 'Form',
      title: 'Inner Handrail Continuity - Data Input',
      fields: [
        { id: 'photo', type: 'photo', label: 'Upload photo (optional)' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q20',
    },
    {
      id: 'Q20',
      type: 'Question',
      text: 'Are the bottoms of the handrail gripping surfaces free of obstructions > 20% of their length?',
      yesNext: 'Q21',
      noNext: 'F20',
    },
    {
      id: 'F20',
      type: 'Form',
      title: 'Handrail Obstructions - Data Input',
      fields: [
        { id: 'photo', type: 'photo', label: 'Upload photo' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q21',
    },
    {
      id: 'Q21',
      type: 'Question',
      text: 'Is the NON-CIRCULAR handrail perimeter between 4" and 6 1/4"?',
      yesNext: 'Q22',
      noNext: 'F21',
    },
    {
      id: 'F21',
      type: 'Form',
      title: 'Non-Circular Handrail - Data Input',
      fields: [
        { id: 'measurements', type: 'number', label: 'Handrail perimeter (inches)' },
        { id: 'photo', type: 'photo', label: 'Upload photo' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q22',
    },
    {
      id: 'Q22',
      type: 'Question',
      text: 'Is the CIRCULAR handrail diameter between 1 1/4" and 2"?',
      yesNext: 'Q23',
      noNext: 'F22',
    },
    {
      id: 'F22',
      type: 'Form',
      title: 'Circular Handrail - Data Input',
      fields: [
        { id: 'measurements', type: 'number', label: 'Handrail diameter (inches)' },
        { id: 'photo', type: 'photo', label: 'Upload photo' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q23',
    },
    {
      id: 'Q23',
      type: 'Question',
      text: 'Does the handrail surface have a free-of-abrasion, corrosive material, or rough edges?',
      yesNext: 'Q24',
      noNext: 'F23',
    },
    {
      id: 'F23',
      type: 'Form',
      title: 'Handrail Surface Condition - Data Input',
      fields: [
        { id: 'measurements', type: 'number', label: 'Quantity' },
        { id: 'photo', type: 'photo', label: 'Upload photo' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q24',
    },
    {
      id: 'Q24',
      type: 'Question',
      text: 'Is there a 1 1/2" separation between the handrail gripping surface and the adjacent surface?',
      yesNext: 'Q25',
      noNext: 'F24',
    },
    {
      id: 'F24',
      type: 'Form',
      title: 'Handrail Separation - Data Input',
      fields: [
        { id: 'measurements', type: 'number', label: 'Separation distance (inches)' },
        { id: 'photo', type: 'photo', label: 'Upload photo' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
        { id: 'quantity', type: 'number', label: 'Linear feet missing' },
      ],
      next: 'Q25',
    },
    {
      id: 'Q25',
      type: 'Question',
      text: 'Is the top gripping surface of the handrails continuous (including around turns)?',
      yesNext: 'Q26',
      noNext: 'F25',
    },
    {
      id: 'F25',
      type: 'Form',
      title: 'Continuous Gripping Surface - Data Input',
      fields: [
        { id: 'photo', type: 'photo', label: 'Upload photo' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
        { id: 'quantity', type: 'number', label: 'Linear feet missing' },
      ],
      next: 'Q26',
    },
    {
      id: 'Q26',
      type: 'Question',
      text: 'Do the handrails extend 12" beyond the top and bottom of the ramp run?',
      yesNext: 'Q27',
      noNext: 'F26',
    },
    {
      id: 'F26',
      type: 'Form',
      title: 'Handrail Extensions - Data Input',
      fields: [
        { id: 'measurements', type: 'number', label: 'Extension length (inches)' },
        { id: 'photo', type: 'photo', label: 'Upload photo' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q27',
    },
    {
      id: 'Q27',
      type: 'Question',
      text: 'Is the handrail gripping surface continuous over obstructions?',
      yesNext: 'Q28',
      noNext: 'F27',
    },
    {
      id: 'F27',
      type: 'Form',
      title: 'Handrail Obstruction Continuity - Data Input',
      fields: [
        { id: 'photo', type: 'photo', label: 'Upload photo' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q28',
    },
    {
      id: 'Q28',
      type: 'Question',
      text: 'Are the extensions returned to a wall, guard, or floor?',
      yesNext: 'Q29',
      noNext: 'F28',
    },
    {
      id: 'F28',
      type: 'Form',
      title: 'Handrail Extension Return - Data Input',
      fields: [
        { id: 'photo', type: 'photo', label: 'Upload photo' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
      ],
      next: 'Q29',
    },
    {
      id: 'Q29',
      type: 'Question',
      text: 'Are the handrail extensions 27" AGL or exactly 12" long?',
      yesNext: 'END',
      noNext: 'F29',
    },
    {
      id: 'F29',
      type: 'Form',
      title: 'Extension Height - Data Input',
      fields: [
        { id: 'measurements', type: 'number', label: 'Max height/projection' },
        { id: 'photo', type: 'photo', label: 'Upload photo' },
        { id: 'notes', type: 'text', label: 'Notes (optional)' },
        { id: 'quantity', type: 'number', label: 'Number of handrail extensions' },
      ],
      next: 'END',
    },
    {
      id: 'END',
      type: 'End',
      message: 'Audit completed 🎉. Please submit your results.',
    },
  ],
}

const allFlows = {
  flows: [
    {
      flowId: 'RampFlow',
      version: 'v1.0',
      steps: flowDetail.steps,
      title: 'Accesibility Audit - Ramps',
    },
  ],
}
// ------------------------

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(body)
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const method = req.method || 'GET'
    if (method === 'GET' && url.pathname === '/flows') return sendJson(res, flowsCatalog)
    if (method === 'GET' && url.pathname === '/flows/all') return sendJson(res, allFlows)
    if (method === 'GET' && url.pathname.startsWith('/flows/')) {
      const flowId = decodeURIComponent(url.pathname.split('/')[2] || '')
      return sendJson(res, { ...flowDetail, flowId })
    }
    sendJson(res, { error: 'Not found' }, 404)
  } catch (e) {
    sendJson(res, { error: String(e) }, 500)
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock API running on http://127.0.0.1:${PORT}`)
})
