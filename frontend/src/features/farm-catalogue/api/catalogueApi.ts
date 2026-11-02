import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { backendPending } from '../../../api/backendPending'
import { catalogueDemoStore, type CatalogueDemoStore } from '../data/catalogueDemoStore'
import type {
  BreedCommand, CatalogueFilters, MedicineCommand, ParameterVersionCommand, PurposeCommand, VaccineCommand,
} from '../types'

export function createCatalogueApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: CatalogueDemoStore }) {
  // Kept for the later backend hookup; backend mode must never read the mock.
  void farmId
  void transport
  const requireLocal = () => { if (mode === 'backend') throw backendPending('danh mục & tham số trại') }
  return {
    // GET /api/farms/{farmId}/catalogues/breeds?q&status
    async listBreeds(filters: CatalogueFilters = {}) { requireLocal(); return store.listBreeds(filters) },
    // POST /api/farms/{farmId}/catalogues/breeds (id = null) · PUT /api/farms/{farmId}/catalogues/breeds/{id}
    async saveBreed(id: number | null, command: BreedCommand) { requireLocal(); return store.saveBreed(id, command) },

    // GET /api/farms/{farmId}/vaccines (lọc q/status phía client khi nối backend)
    async listVaccines(filters: CatalogueFilters = {}) { requireLocal(); return store.listVaccines(filters) },
    // POST /api/farms/{farmId}/vaccines · PUT /api/farms/{farmId}/vaccines/{vaccineId}
    async saveVaccine(id: number | null, command: VaccineCommand) { requireLocal(); return store.saveVaccine(id, command) },
    // DELETE /api/farms/{farmId}/vaccines/{vaccineId}
    async deleteVaccine(id: number) { requireLocal(); return store.deleteVaccine(id) },

    // GET /api/farms/{farmId}/medicines (lọc q/status phía client khi nối backend)
    async listMedicines(filters: CatalogueFilters = {}) { requireLocal(); return store.listMedicines(filters) },
    // POST /api/farms/{farmId}/medicines · PUT /api/farms/{farmId}/medicines/{medicineId}
    async saveMedicine(id: number | null, command: MedicineCommand) { requireLocal(); return store.saveMedicine(id, command) },

    // GET /api/farms/{farmId}/catalogues/production-purposes?q&status
    async listPurposes(filters: CatalogueFilters = {}) { requireLocal(); return store.listPurposes(filters) },
    // POST /api/farms/{farmId}/catalogues/production-purposes · PUT /api/farms/{farmId}/catalogues/production-purposes/{id}
    async savePurpose(id: number | null, command: PurposeCommand) { requireLocal(); return store.savePurpose(id, command) },

    // GET /api/farms/{farmId}/parameters/versions
    async listParameterVersions() { requireLocal(); return store.listParameterVersions() },
    // POST /api/farms/{farmId}/parameters/versions (tác giả do backend lấy từ phiên đăng nhập)
    async saveParameterVersion(command: ParameterVersionCommand, author = 'Chủ trại') { requireLocal(); return store.saveParameterVersion(command, author) },
  }
}
export type CatalogueApi = ReturnType<typeof createCatalogueApi>
export const catalogueApi = createCatalogueApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: catalogueDemoStore })
