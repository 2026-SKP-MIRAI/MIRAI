import '@testing-library/jest-dom'
import { beforeEach } from 'vitest'
import { _clearStoreForTesting } from '@/lib/rate-limit'

beforeEach(() => {
  _clearStoreForTesting()
})
