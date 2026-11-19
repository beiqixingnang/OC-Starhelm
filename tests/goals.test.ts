import assert from "node:assert/strict"
import test from "node:test"
import { applyGoalOperation, activeGoalContext, emptyGoalTree, findGoal, renderGoalTree } from "../.opencode/plugins/starhelm/goals.js"

test("goal hierarchy is limited to three levels", () => {
  const tree = emptyGoalTree()
  applyGoalOperation(tree, { type: "add", title: "Release" })
  const top = tree.goals[0]
  applyGoalOperation(tree, { type: "add", parentID: top.id, title: "API" })
  const second = top.children[0]
  applyGoalOperation(tree, { type: "add", parentID: second.id, title: "Auth endpoint" })

  assert.equal(findGoal(tree.goals, top.children[0].children[0].id)?.level, 3)
  assert.throws(() => applyGoalOperation(tree, { type: "add", parentID: second.children[0].id, title: "Too deep" }), /three levels/)
})

test("parent completion and acceptance wait for accepted children", () => {
  const tree = emptyGoalTree()
  applyGoalOperation(tree, { type: "add", title: "Release" })
  const parent = tree.goals[0]
  applyGoalOperation(tree, { type: "add", parentID: parent.id, title: "API" })
  const child = parent.children[0]

  assert.throws(() => applyGoalOperation(tree, { type: "status", goalID: parent.id, status: "completed" }), /child goals are accepted/)
  applyGoalOperation(tree, { type: "status", goalID: child.id, status: "completed" })
  applyGoalOperation(tree, { type: "accept", goalID: child.id, reason: "Checks pass" })
  applyGoalOperation(tree, { type: "status", goalID: parent.id, status: "completed" })
  applyGoalOperation(tree, { type: "accept", goalID: parent.id, reason: "API is ready" })

  assert.equal(parent.status, "accepted")
})

test("goal view and active context include status and criteria", () => {
  const tree = emptyGoalTree()
  applyGoalOperation(tree, { type: "add", title: "Ship feature", acceptanceCriteria: "Tests pass" })
  const goal = tree.goals[0]
  applyGoalOperation(tree, { type: "status", goalID: goal.id, status: "in_progress" })

  assert.match(renderGoalTree(tree), /Acceptance: Tests pass/)
  assert.match(activeGoalContext(tree), /Ship feature/)
  applyGoalOperation(tree, { type: "status", goalID: goal.id, status: "completed" })
  assert.match(activeGoalContext(tree), /\[completed\]/)
})

test("changing a child reopens an accepted ancestor", () => {
  const tree = emptyGoalTree()
  applyGoalOperation(tree, { type: "add", title: "Release" })
  const parent = tree.goals[0]
  applyGoalOperation(tree, { type: "add", parentID: parent.id, title: "API" })
  const child = parent.children[0]
  applyGoalOperation(tree, { type: "status", goalID: child.id, status: "completed" })
  applyGoalOperation(tree, { type: "accept", goalID: child.id, reason: "Verified" })
  applyGoalOperation(tree, { type: "status", goalID: parent.id, status: "completed" })
  applyGoalOperation(tree, { type: "accept", goalID: parent.id, reason: "Verified" })

  applyGoalOperation(tree, { type: "reject", goalID: child.id, reason: "Needs a follow-up fix" })
  assert.equal(parent.status, "in_progress")
})

test("three levels are accepted in order from leaf to root", () => {
  const tree = emptyGoalTree()
  applyGoalOperation(tree, { type: "add", title: "Product launch" })
  const root = tree.goals[0]
  applyGoalOperation(tree, { type: "add", parentID: root.id, title: "Editor" })
  const middle = root.children[0]
  applyGoalOperation(tree, { type: "add", parentID: middle.id, title: "Goal tree" })
  const leaf = middle.children[0]

  assert.throws(() => applyGoalOperation(tree, { type: "status", goalID: root.id, status: "completed" }), /child goals are accepted/)
  applyGoalOperation(tree, { type: "status", goalID: leaf.id, status: "completed" })
  applyGoalOperation(tree, { type: "accept", goalID: leaf.id, reason: "Feature verified" })
  applyGoalOperation(tree, { type: "status", goalID: middle.id, status: "completed" })
  applyGoalOperation(tree, { type: "accept", goalID: middle.id, reason: "Editor verified" })
  applyGoalOperation(tree, { type: "status", goalID: root.id, status: "completed" })
  applyGoalOperation(tree, { type: "accept", goalID: root.id, reason: "Launch criteria met" })

  assert.equal(root.status, "accepted")
  assert.equal(middle.status, "accepted")
  assert.equal(leaf.status, "accepted")
})
