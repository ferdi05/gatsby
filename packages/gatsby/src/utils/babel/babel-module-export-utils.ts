import {
  ExportNamedDeclaration,
  isIdentifier,
  isExportSpecifier,
} from "@babel/types"
import { Visitor, NodePath } from "@babel/core"

/**
 * Shared module export comparator functions and visitors used in Babel traversals.
 */

/**
 * Match a specific named export function declaration with `@babel/parser`. Matches:
 * ```
 * export function name() {}
 * export async function name() {}
 * ```
 */
function isNamedExportFunction(
  node: ExportNamedDeclaration,
  name: string
): boolean {
  return (
    node.declaration?.type === `FunctionDeclaration` &&
    node.declaration.id?.name === name
  )
}

/**
 * Match a specific named export variable declaration with `@babel/parser`. Matches:
 * ```
 * export const name = () => {} // or `let`/`var`
 * export let name1, name2, nameN // or `var`, const requires an initial assignment
 * ```
 */
function isNamedExportVariable(
  node: ExportNamedDeclaration,
  name: string
): boolean {
  if (node.declaration?.type !== `VariableDeclaration`) {
    return false
  }

  for (const declaration of node.declaration?.declarations) {
    if (declaration.type !== `VariableDeclarator`) {
      return false
    }

    if (declaration.id.type !== `Identifier`) {
      return false
    }

    return declaration.id.name === name
  }

  return false
}

/**
 * Match a specific named export destructured variable declaration with `@babel/parser`. Matches:
 * ```
 * export const { name } = {} // or `let`/`var`
 * export const { name1, name2: bar } = {} // or `let`/`var`
 * ```
 */
function isNamedExportDestructuredVariable(
  node: ExportNamedDeclaration,
  name: string
): boolean {
  if (node.declaration?.type !== `VariableDeclaration`) {
    return false
  }

  for (const declaration of node.declaration?.declarations) {
    if (declaration.type !== `VariableDeclarator`) {
      return false
    }

    if (declaration.id.type !== `ObjectPattern`) {
      return false
    }

    for (let i = 0; i < declaration.id.properties.length; i++) {
      const property = declaration.id.properties[i]

      if (property.type !== `ObjectProperty` || !isIdentifier(property.value)) {
        return false
      }

      return property.value.name === name
    }
  }

  return false
}

/**
 * Inclusively match a specific export specifier with `@babel/parser`. Matches:
 * ```
 * export { name1, name2, nameN }
 * ```
 */
function isNamedExportSpecifier(
  node: ExportNamedDeclaration,
  name: string
): boolean {
  return node.specifiers.some(
    specifier =>
      isExportSpecifier(specifier) &&
      isIdentifier(specifier.exported) &&
      specifier.exported.name === name
  )
}

/**
 * Match a variety of specific named exports with `@babel/parser`. Match criteria:
 * @see {@link isNamedExportFunction}
 * @see {@link isNamedExportVariable}
 * @see {@link isNamedExportSpecifier}
 */
function isNamedExport(node: ExportNamedDeclaration, name: string): boolean {
  return (
    isNamedExportFunction(node, name) ||
    isNamedExportVariable(node, name) ||
    isNamedExportDestructuredVariable(node, name) ||
    isNamedExportSpecifier(node, name)
  )
}

/**
 * Remove specific properties from a destructured variable named export.
 *
 * @example
 * To remove exports like these:
 * ```
 * export const { foo } = {} // or `let`/`var`
 * export const { foo, bar: baz } = {} // or `let`/`var`
 * ```
 *
 * traverse inside an `ExportNamedDeclaration` node:
 * ```
 * ExportNamedDeclaration(path, state): void {
 *  path.traverse(RemoveNamedExportVisitor, { propertiesToRemove: [`foo`, `baz`] })
 * }
 * ```
 */
const RemoveNamedExportPropertiesVisitor: Visitor<{
  propertiesToRemove: Array<string>
}> = {
  ObjectPattern(objectPath) {
    for (let i = 0; i < objectPath.node.properties.length; i++) {
      const property = objectPath.node.properties[i]
      if (
        property.type === `ObjectProperty` &&
        property.value.type === `Identifier` &&
        this.propertiesToRemove.includes(property.value.name)
      ) {
        const propertyPath = objectPath.get(`properties.${i}`)
        if (propertyPath instanceof NodePath) {
          propertyPath.remove()
        }
      }
    }
  },
}

export {
  isNamedExportFunction,
  isNamedExportVariable,
  isNamedExportDestructuredVariable,
  isNamedExportSpecifier,
  isNamedExport,
  RemoveNamedExportPropertiesVisitor,
}
