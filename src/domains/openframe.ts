/**
 * OpenFrame External API tool definitions.
 */

import type { ToolSpec } from "../utils/types.js";
import { createDomainHandler } from "../utils/handler.js";

type OpenFramePropertySchema = {
  type?: string;
  enum?: string[];
  items?: unknown;
  format?: string;
  default?: unknown;
  description?: string;
};

function makeTool(
  name: string,
  description: string,
  tier: "read" | "write" | "admin",
  method: ToolSpec["method"],
  path: string,
  properties: Record<string, OpenFramePropertySchema>,
  required: string[] = [],
): ToolSpec {
  const isDestructive = /delete|remove|archive|unarchive|transition/i.test(name);
  const destructive = tier === "admin" || isDestructive;
  const finalDescription = tier === "admin"
    ? `⚠ HIGH-IMPACT [admin] ${description}`
    : tier === "write"
      ? `[write] ${description}`
      : description;

  return {
    tool: {
      name,
      description: finalDescription,
      annotations: {
        title: `OpenFrame: ${name}`,
        readOnlyHint: tier === "read",
        destructiveHint: destructive,
        idempotentHint: method === "GET" || method === "DELETE",
        openWorldHint: true,
      },
      inputSchema: {
        type: "object",
        properties,
        ...(required.length > 0 ? { required } : {}),
      },
    },
    operation: name.replace(/^openframe_/, ""),
    method,
    path,
  };
}

export const openframeSpecs: ToolSpec[] = [
  makeTool("openframe_customer_list", "List OpenFrame customers with optional filters, search, sorting, and pagination.", "read", "GET", "/customers", {
    category: { type: "string" },
    minEmployees: { type: "integer" },
    maxEmployees: { type: "integer" },
    hasActiveContract: { type: "boolean" },
    status: { type: "string", enum: ["ACTIVE", "ARCHIVED"] },
    lastActivityFrom: { type: "string", format: "date-time" },
    lastActivityTo: { type: "string", format: "date-time" },
    search: { type: "string" },
    limit: { type: "integer" },
    cursor: { type: "string" },
    sortField: { type: "string" },
    sortDirection: { type: "string", enum: ["ASC", "DESC"] },
  }),
  makeTool("openframe_customer_get", "Get one OpenFrame customer by id.", "read", "GET", "/customers/{id}", {
    id: { type: "string" },
  }, ["id"]),
  makeTool("openframe_customer_can_archive", "Check whether an OpenFrame customer can be archived.", "read", "GET", "/customers/{id}/can-archive", {
    id: { type: "string" },
  }, ["id"]),
  makeTool("openframe_device_list", "List OpenFrame devices with optional filters, search, sorting, pagination, and tags.", "read", "GET", "/devices", {
    statuses: { type: "array", items: { type: "string" } },
    deviceTypes: { type: "array", items: { type: "string" } },
    osTypes: { type: "array", items: { type: "string" } },
    customerIds: { type: "array", items: { type: "string" } },
    tagKeys: { type: "array", items: { type: "string" } },
    tagValues: { type: "array", items: { type: "string" } },
    search: { type: "string" },
    includeTags: { type: "boolean" },
    limit: { type: "integer" },
    cursor: { type: "string" },
    sortField: { type: "string" },
    sortDirection: { type: "string", enum: ["ASC", "DESC"] },
  }),
  makeTool("openframe_device_get", "Get one OpenFrame device by machine id.", "read", "GET", "/devices/{machineId}", {
    machineId: { type: "string" },
  }, ["machineId"]),
  makeTool("openframe_device_filters", "List OpenFrame device filter options with counts.", "read", "GET", "/devices/filters", {}),
  makeTool("openframe_ticket_list", "List OpenFrame tickets with optional filters, search, sorting, pagination, and tags.", "read", "GET", "/tickets", {
    statusIds: { type: "array", items: { type: "string" } },
    customerIds: { type: "array", items: { type: "string" } },
    assigneeIds: { type: "array", items: { type: "string" } },
    tagIds: { type: "array", items: { type: "string" } },
    search: { type: "string" },
    limit: { type: "integer" },
    cursor: { type: "string" },
    sortField: { type: "string" },
    sortDirection: { type: "string", enum: ["ASC", "DESC"] },
  }),
  makeTool("openframe_ticket_filters", "List OpenFrame ticket filter options with counts.", "read", "GET", "/tickets/filters", {}),
  makeTool("openframe_ticket_statuses", "List OpenFrame ticket statuses and available transitions.", "read", "GET", "/tickets/statuses", {}),
  makeTool("openframe_ticket_tags", "List OpenFrame ticket tags.", "read", "GET", "/tickets/tags", {}),
  makeTool("openframe_ticket_statistics", "Get OpenFrame ticket statistics.", "read", "GET", "/tickets/statistics", {}),
  makeTool("openframe_ticket_get", "Get one OpenFrame ticket by id.", "read", "GET", "/tickets/{id}", {
    id: { type: "string" },
  }, ["id"]),
  makeTool("openframe_log_list", "List OpenFrame logs with optional filters, search, sorting, pagination.", "read", "GET", "/logs", {
    startDate: { type: "string", format: "date" },
    endDate: { type: "string", format: "date" },
    timestampFrom: { type: "string", format: "date-time" },
    timestampTo: { type: "string", format: "date-time" },
    toolTypes: { type: "array", items: { type: "string" } },
    eventTypes: { type: "array", items: { type: "string" } },
    severities: { type: "array", items: { type: "string" } },
    customerIds: { type: "array", items: { type: "string" } },
    deviceId: { type: "string" },
    search: { type: "string" },
    limit: { type: "integer" },
    cursor: { type: "string" },
    sortField: { type: "string" },
    sortDirection: { type: "string", enum: ["ASC", "DESC"] },
  }),
  makeTool("openframe_log_filters", "List OpenFrame log filter options.", "read", "GET", "/logs/filters", {}),
  makeTool("openframe_log_details", "Get one OpenFrame log entry by its composite key.", "read", "GET", "/logs/details", {
    ingestDay: { type: "string", format: "date" },
    toolType: { type: "string" },
    eventType: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
    toolEventId: { type: "string" },
  }, ["ingestDay", "toolType", "eventType", "timestamp", "toolEventId"]),
  makeTool("openframe_knowledge_base_item_list", "List OpenFrame knowledge base items with optional filters, search, sorting, pagination.", "read", "GET", "/knowledge-base/items", {
    parentId: { type: "string" },
    type: { type: "string", enum: ["FOLDER", "ARTICLE"] },
    statuses: { type: "array", items: { type: "string" } },
    tagIds: { type: "array", items: { type: "string" } },
    search: { type: "string" },
    limit: { type: "integer" },
    cursor: { type: "string" },
  }),
  makeTool("openframe_knowledge_base_item_get", "Get one OpenFrame knowledge base item by id.", "read", "GET", "/knowledge-base/items/{id}", {
    id: { type: "string" },
  }, ["id"]),
  makeTool("openframe_knowledge_base_folders_list", "List OpenFrame knowledge base folders.", "read", "GET", "/knowledge-base/folders", {}),
  makeTool("openframe_knowledge_base_archived_articles_list", "List archived OpenFrame knowledge base articles.", "read", "GET", "/knowledge-base/articles/archived", {}),
  makeTool("openframe_knowledge_base_tags", "List OpenFrame knowledge base tags, optionally scoped to a folder subtree.", "read", "GET", "/knowledge-base/tags", {
    folderId: { type: "string" },
    archived: { type: "boolean" },
  }),
  makeTool("openframe_tool_list", "List integrated OpenFrame tools with optional filters.", "read", "GET", "/tools", {
    enabled: { type: "boolean" },
    type: { type: "string" },
    search: { type: "string" },
    category: { type: "string" },
    platformCategory: { type: "string" },
    sortField: { type: "string" },
    sortDirection: { type: "string", enum: ["ASC", "DESC"] },
  }),
  makeTool("openframe_tool_filters", "List integrated OpenFrame tool filter options.", "read", "GET", "/tools/filters", {}),

  makeTool("openframe_customer_create", "Create an OpenFrame customer.", "write", "POST", "/customers", {
    name: { type: "string" },
    category: { type: "string" },
    status: { type: "string", enum: ["ACTIVE", "ARCHIVED"] },
    isActive: { type: "boolean" },
    minEmployees: { type: "integer" },
    maxEmployees: { type: "integer" },
    hasActiveContract: { type: "boolean" },
  }),
  makeTool("openframe_customer_update", "Update an OpenFrame customer partially by id.", "write", "PUT", "/customers/{id}", {
    id: { type: "string" },
    name: { type: "string" },
    category: { type: "string" },
    status: { type: "string", enum: ["ACTIVE", "ARCHIVED"] },
    isActive: { type: "boolean" },
    minEmployees: { type: "integer" },
    maxEmployees: { type: "integer" },
    hasActiveContract: { type: "boolean" },
  }, ["id"]),
  makeTool("openframe_device_update_status", "Update an OpenFrame device status by machine id.", "write", "PATCH", "/devices/{machineId}", {
    machineId: { type: "string" },
    status: { type: "string", enum: ["DELETED", "ARCHIVED"] },
  }, ["machineId", "status"]),
  makeTool("openframe_device_update_nickname", "Update an OpenFrame device nickname by machine id.", "write", "PATCH", "/devices/{machineId}/nickname", {
    machineId: { type: "string" },
    nickname: { type: "string" },
  }, ["machineId", "nickname"]),

  makeTool("openframe_ticket_create", "Create an OpenFrame ticket.", "write", "POST", "/tickets", {
    title: { type: "string" },
    description: { type: "string" },
    machineId: { type: "string" },
    customerId: { type: "string" },
    statusId: { type: "string" },
    assigneeId: { type: "string" },
    tagIds: { type: "array", items: { type: "string" } },
    priority: { type: "integer" },
  }),
  makeTool("openframe_ticket_update", "Update an OpenFrame ticket partially by id.", "write", "PUT", "/tickets/{id}", {
    id: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    machineId: { type: "string" },
    customerId: { type: "string" },
    assigneeId: { type: "string" },
    tagIds: { type: "array", items: { type: "string" } },
    priority: { type: "integer" },
  }, ["id"]),
  makeTool("openframe_ticket_transition", "Transition an OpenFrame ticket to a valid status.", "write", "POST", "/tickets/{id}/transition", {
    id: { type: "string" },
    statusId: { type: "string" },
    reason: { type: "string" },
  }, ["id", "statusId"]),
  makeTool("openframe_ticket_assign", "Assign an OpenFrame ticket to a user.", "write", "POST", "/tickets/{id}/assign", {
    id: { type: "string" },
    assigneeId: { type: "string" },
  }, ["id", "assigneeId"]),
  makeTool("openframe_ticket_add_tag", "Add a tag to an OpenFrame ticket.", "write", "POST", "/tickets/{id}/tags/{tagId}", {
    id: { type: "string" },
    tagId: { type: "string" },
  }, ["id", "tagId"]),
  makeTool("openframe_ticket_note_add", "Add an internal note to an OpenFrame ticket.", "write", "POST", "/tickets/{id}/notes", {
    id: { type: "string" },
    content: { type: "string" },
  }, ["id", "content"]),
  makeTool("openframe_ticket_note_update", "Update an OpenFrame ticket note by note id.", "write", "PUT", "/tickets/{id}/notes/{noteId}", {
    id: { type: "string" },
    noteId: { type: "string" },
    content: { type: "string" },
  }, ["id", "noteId", "content"]),

  makeTool("openframe_knowledge_base_item_move", "Move an OpenFrame knowledge base item to a parent folder.", "write", "POST", "/knowledge-base/items/{id}/move", {
    id: { type: "string" },
    parentId: { type: "string" },
  }, ["id", "parentId"]),
  makeTool("openframe_knowledge_base_item_add_tag", "Add a tag to an OpenFrame knowledge base item.", "write", "POST", "/knowledge-base/items/{id}/tags/{tagId}", {
    id: { type: "string" },
    tagId: { type: "string" },
  }, ["id", "tagId"]),
  makeTool("openframe_knowledge_base_folder_create", "Create an OpenFrame knowledge base folder.", "write", "POST", "/knowledge-base/folders", {
    name: { type: "string" },
    parentId: { type: "string" },
  }),
  makeTool("openframe_knowledge_base_folder_rename", "Rename an OpenFrame knowledge base folder.", "write", "PUT", "/knowledge-base/folders/{id}", {
    id: { type: "string" },
    name: { type: "string" },
  }, ["id", "name"]),
  makeTool("openframe_knowledge_base_article_create", "Create an OpenFrame knowledge base article.", "write", "POST", "/knowledge-base/articles", {
    title: { type: "string" },
    content: { type: "string" },
    summary: { type: "string" },
    status: { type: "string", enum: ["DRAFT", "PUBLISHED"] },
    parentId: { type: "string" },
    tagIds: { type: "array", items: { type: "string" } },
  }),
  makeTool("openframe_knowledge_base_article_update", "Update an OpenFrame knowledge base article.", "write", "PUT", "/knowledge-base/articles/{id}", {
    id: { type: "string" },
    title: { type: "string" },
    content: { type: "string" },
    summary: { type: "string" },
    status: { type: "string", enum: ["DRAFT", "PUBLISHED"] },
    parentId: { type: "string" },
    tagIds: { type: "array", items: { type: "string" } },
  }, ["id"]),
  makeTool("openframe_knowledge_base_article_publish", "Publish an OpenFrame knowledge base article.", "write", "POST", "/knowledge-base/articles/{id}/publish", {
    id: { type: "string" },
  }, ["id"]),
  makeTool("openframe_knowledge_base_article_unpublish", "Unpublish an OpenFrame knowledge base article.", "write", "POST", "/knowledge-base/articles/{id}/unpublish", {
    id: { type: "string" },
  }, ["id"]),
  makeTool("openframe_knowledge_base_article_unarchive", "Unarchive an OpenFrame knowledge base article into a folder.", "write", "POST", "/knowledge-base/articles/{id}/unarchive", {
    id: { type: "string" },
    parentId: { type: "string" },
  }, ["id", "parentId"]),
  makeTool("openframe_knowledge_base_attachment_create", "Register an OpenFrame knowledge base attachment upload.", "write", "POST", "/knowledge-base/articles/{id}/attachments", {
    id: { type: "string" },
    fileName: { type: "string" },
    contentType: { type: "string" },
    fileSize: { type: "integer" },
  }, ["id", "fileName", "contentType", "fileSize"]),

  makeTool("openframe_ticket_unassign", "Unassign an OpenFrame ticket from an assignee.", "admin", "POST", "/tickets/{id}/unassign", {
    id: { type: "string" },
  }, ["id"]),
  makeTool("openframe_ticket_unlink_device", "Unlink an OpenFrame ticket from a device.", "admin", "POST", "/tickets/{id}/unlink-device", {
    id: { type: "string" },
  }, ["id"]),
  makeTool("openframe_ticket_unlink_customer", "Unlink an OpenFrame ticket from a customer.", "admin", "POST", "/tickets/{id}/unlink-customer", {
    id: { type: "string" },
  }, ["id"]),
  makeTool("openframe_ticket_note_delete", "Delete an OpenFrame ticket note. Only the note author may delete it.", "admin", "DELETE", "/tickets/{id}/notes/{noteId}", {
    id: { type: "string" },
    noteId: { type: "string" },
  }, ["id", "noteId"]),
  makeTool("openframe_ticket_tag_remove", "Remove a tag from an OpenFrame ticket.", "admin", "DELETE", "/tickets/{id}/tags/{tagId}", {
    id: { type: "string" },
    tagId: { type: "string" },
  }, ["id", "tagId"]),
  makeTool("openframe_knowledge_base_item_tag_remove", "Remove a tag from an OpenFrame knowledge base item.", "admin", "DELETE", "/knowledge-base/items/{id}/tags/{tagId}", {
    id: { type: "string" },
    tagId: { type: "string" },
  }, ["id", "tagId"]),
  makeTool("openframe_knowledge_base_folder_delete", "Delete an OpenFrame knowledge base folder.", "admin", "DELETE", "/knowledge-base/folders/{id}", {
    id: { type: "string" },
  }, ["id"]),
  makeTool("openframe_knowledge_base_attachment_delete", "Delete an OpenFrame knowledge base attachment.", "admin", "DELETE", "/knowledge-base/attachments/{attachmentId}", {
    attachmentId: { type: "string" },
  }, ["attachmentId"]),
  makeTool("openframe_customer_status", "Change or archive an OpenFrame customer status.", "admin", "PATCH", "/customers/{id}/status", {
    id: { type: "string" },
    status: { type: "string", enum: ["ACTIVE", "ARCHIVED"] },
  }, ["id", "status"]),
  makeTool("openframe_knowledge_base_article_archive", "Archive an OpenFrame knowledge base article.", "admin", "POST", "/knowledge-base/articles/{id}/archive", {
    id: { type: "string" },
  }, ["id"]),
];

export const openframeDomainHandler = createDomainHandler(openframeSpecs);
