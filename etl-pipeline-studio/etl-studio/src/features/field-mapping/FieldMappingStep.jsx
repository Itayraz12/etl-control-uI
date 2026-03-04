import { useState, useRef, useEffect } from 'react'
import { useWizard } from '../../shared/store/wizardStore.jsx'
import { MOCK_SCHEMA, TARGET_FIELDS } from '../../shared/types/index.js'
import FieldMappingCanvas from './FieldMappingStepCanvas.jsx'

export default function FieldMappingStep() {
  return <FieldMappingCanvas />
}
