// Durable notification inbox. SQLite is the source of truth; SSE is a best-effort nudge.
// A rowid cursor avoids timestamp ties when several notifications arrive in one second.
import {one,query} from './db.js';
import {error} from './security.js';

// Do not reveal private projects to nonmembers, even through notifications.
// Pending collaboration invitations can be displayed to their intended recipient.
const visible=`(n.project_id IS NULL OR n.project_id='' OR EXISTS (
  SELECT 1 FROM projects p WHERE p.id=n.project_id AND (
    p.visibility IN ('public','unlisted') OR p.creator_id=? OR
    (n.kind='collaboration' AND EXISTS (
      SELECT 1 FROM collaborative_members m WHERE m.project_id=p.id
      AND m.user_id=? AND m.state IN ('pending','active')
    ))
  )
))`;
const bind=(userId)=>[userId,userId,userId];
export function inbox(userId,{after=0,limit=50}={}){
  if(!Number.isSafeInteger(after)||after<0)throw error(400,'Invalid notification cursor.');
  if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw error(400,'Notification limit must be 1–100.');
  const rows=query(`SELECT n.rowid cursor,n.id,n.kind,n.project_id projectId,n.read,
      n.created_at createdAt,u.name actor,u.handle actorHandle
    FROM notifications n JOIN users u ON u.id=n.actor_id
    WHERE n.user_id=? AND n.rowid>? AND ${visible}
    ORDER BY n.rowid ASC LIMIT ?`,userId,after,userId,userId,limit+1);
  const hasMore=rows.length>limit;
  const items=rows.slice(0,limit);
  const unreadCount=one(`SELECT COUNT(*) n FROM notifications n
    WHERE n.user_id=? AND n.read=0 AND ${visible}`,...bind(userId)).n;
  return {items,cursor:items.at(-1)?.cursor??after,hasMore,unreadCount};
}
export function recentNotifications(userId,limit=100){
  return query(`SELECT n.rowid cursor,n.id,n.kind,n.project_id projectId,n.read,
      n.created_at createdAt,u.name actor,u.handle actorHandle
    FROM notifications n JOIN users u ON u.id=n.actor_id
    WHERE n.user_id=? AND ${visible}
    ORDER BY n.rowid DESC LIMIT ?`,userId,userId,userId,limit);
}
export function latestCursor(userId){return one('SELECT COALESCE(MAX(rowid),0) cursor FROM notifications WHERE user_id=?',userId).cursor;}
