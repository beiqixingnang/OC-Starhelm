export type GoalStatus = "pending" | "in_progress" | "completed" | "accepted" | "rejected"

export interface GoalNode {
  id: string
  title: string
  description?: string
  status: GoalStatus
  level: 1 | 2 | 3
  parentID?: string
  acceptanceCriteria?: string
  acceptanceNote?: string
  createdAt: string
  updatedAt: string
  children: GoalNode[]
}

export interface GoalTree {
  version: 1
  goals: GoalNode[]
}

export type GoalOperation =
  | { type: "add"; title: string; parentID?: string; description?: string; acceptanceCriteria?: string }
  | { type: "status"; goalID: string; status: "in_progress" | "completed" }
  | { type: "accept"; goalID: string; reason: string }
  | { type: "reject"; goalID: string; reason: string }

export function emptyGoalTree(): GoalTree {
  return { version: 1, goals: [] }
}

export function findGoal(goals: GoalNode[], goalID: string): GoalNode | undefined {
  for (const goal of goals) {
    if (goal.id === goalID) return goal
    const child = findGoal(goal.children, goalID)
    if (child) return child
  }
}

export function findGoalPath(goals: GoalNode[], goalID: string): GoalNode[] | undefined {
  for (const goal of goals) {
    if (goal.id === goalID) return [goal]
    const childPath = findGoalPath(goal.children, goalID)
    if (childPath) return [goal, ...childPath]
  }
}

export function applyGoalOperation(tree: GoalTree, operation: GoalOperation, now = new Date()): GoalTree {
  const timestamp = now.toISOString()

  if (operation.type === "add") {
    const title = operation.title.trim()
    if (!title) throw new Error("Goal title cannot be empty")

    let siblings = tree.goals
    let level: GoalNode["level"] = 1
    let parent: GoalNode | undefined
    if (operation.parentID) {
      parent = findGoal(tree.goals, operation.parentID)
      if (!parent) throw new Error(`Parent goal not found: ${operation.parentID}`)
      if (parent.level >= 3) throw new Error("Goals can be nested at most three levels deep")
      for (const ancestor of findGoalPath(tree.goals, parent.id) ?? []) {
        if (ancestor.status === "accepted") {
          ancestor.status = "in_progress"
          ancestor.acceptanceNote = undefined
          ancestor.updatedAt = timestamp
        }
      }
      level = (parent.level + 1) as GoalNode["level"]
      siblings = parent.children
    }

    const goal: GoalNode = {
      id: crypto.randomUUID().slice(0, 8),
      title,
      ...(operation.description?.trim() ? { description: operation.description.trim() } : {}),
      status: "pending",
      level,
      ...(parent ? { parentID: parent.id } : {}),
      ...(operation.acceptanceCriteria?.trim() ? { acceptanceCriteria: operation.acceptanceCriteria.trim() } : {}),
      createdAt: timestamp,
      updatedAt: timestamp,
      children: [],
    }
    siblings.push(goal)
    if (parent) parent.updatedAt = timestamp
    return tree
  }

  const goal = findGoal(tree.goals, operation.goalID)
  if (!goal) throw new Error(`Goal not found: ${operation.goalID}`)
  for (const ancestor of (findGoalPath(tree.goals, goal.id) ?? []).slice(0, -1)) {
    if (ancestor.status === "accepted") {
      ancestor.status = "in_progress"
      ancestor.acceptanceNote = undefined
      ancestor.updatedAt = timestamp
    }
  }

  if (operation.type === "status") {
    if (operation.status === "completed" && goal.children.some((child) => child.status !== "accepted")) {
      throw new Error("A parent goal can be completed after all direct child goals are accepted")
    }
    goal.status = operation.status
    goal.acceptanceNote = undefined
  } else if (operation.type === "accept") {
    if (goal.status !== "completed") {
      throw new Error("A goal must be completed before it can be accepted")
    }
    if (!operation.reason.trim()) throw new Error("An acceptance rationale is required")
    if (goal.children.some((child) => child.status !== "accepted")) {
      throw new Error("All direct child goals must be accepted first")
    }
    goal.status = "accepted"
    goal.acceptanceNote = operation.reason.trim()
  } else {
    if (!operation.reason.trim()) throw new Error("A rejection reason is required")
    goal.status = "rejected"
    goal.acceptanceNote = operation.reason.trim()
  }

  goal.updatedAt = timestamp
  return tree
}

export function renderGoalTree(tree: GoalTree): string {
  if (tree.goals.length === 0) return "No goals yet. Use `/goal add <title>` to create a top-level goal."
  const lines: string[] = []
  const visit = (goals: GoalNode[]) => {
    for (const goal of goals) {
      const marker = goal.status === "accepted" ? "[accepted]" : `[${goal.status}]`
      lines.push(`${"  ".repeat(goal.level - 1)}- ${marker} ${goal.title} (id: ${goal.id})`)
      if (goal.description) lines.push(`${"  ".repeat(goal.level)}${goal.description}`)
      if (goal.acceptanceCriteria) lines.push(`${"  ".repeat(goal.level)}Acceptance: ${goal.acceptanceCriteria}`)
      if (goal.acceptanceNote) lines.push(`${"  ".repeat(goal.level)}  Note: ${goal.acceptanceNote}`)
      visit(goal.children)
    }
  }
  visit(tree.goals)
  return lines.join("\n")
}

export function activeGoalContext(tree: GoalTree): string {
  const active: GoalNode[][] = []
  const visit = (goals: GoalNode[], parents: GoalNode[]) => {
    for (const goal of goals) {
      const path = [...parents, goal]
      if (goal.status !== "accepted") active.push(path)
      visit(goal.children, path)
    }
  }
  visit(tree.goals, [])
  if (active.length === 0) return ""

  return [
    "Open Starhelm goals (shared across this session tree):",
    ...active.map((path) => {
      const goal = path.at(-1)!
      const hierarchy = path.map((item) => item.title).join(" > ")
      return `- [${goal.status}] ${hierarchy} (id: ${goal.id})${goal.description ? `\n  Details: ${goal.description}` : ""}${goal.acceptanceCriteria ? `\n  Acceptance criteria: ${goal.acceptanceCriteria}` : ""}`
    }),
    "Use the Starhelm goal tools to update progress. Mark work completed when implementation is done; the primary model is responsible for acceptance.",
  ].join("\n")
}
