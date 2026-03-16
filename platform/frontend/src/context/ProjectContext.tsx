import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { projectsApi, type Project } from '../lib/api'

const LS_KEY = 'MONITOR_CURRENT_APP_ID'

interface ProjectContextValue {
  projects: Project[]
  currentProject: Project | null
  loading: boolean
  setCurrentProject: (p: Project) => void
  reload: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextValue>({
  projects: [],
  currentProject: null,
  loading: true,
  setCurrentProject: () => {},
  reload: async () => {},
})

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const list = await projectsApi.list()
      setProjects(list)

      const savedAppId = localStorage.getItem(LS_KEY)
      const saved = list.find((p) => p.appId === savedAppId)
      // Pick saved → first → null
      setCurrentProjectState((prev) => {
        if (saved) return saved
        if (prev) {
          const still = list.find((p) => p.id === prev.id)
          if (still) return still
        }
        return list[0] ?? null
      })
    } catch {
      // backend not reachable yet — keep previous state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const setCurrentProject = useCallback((p: Project) => {
    setCurrentProjectState(p)
    localStorage.setItem(LS_KEY, p.appId)
  }, [])

  return (
    <ProjectContext.Provider value={{ projects, currentProject, loading, setCurrentProject, reload }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  return useContext(ProjectContext)
}
