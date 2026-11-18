/**
 * Notices API Routes
 * Server-side only - uses Firebase Admin SDK
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listNotices,
  createNotice,
  getNotice,
  updateNotice,
  deleteNotice,
  seedSyntheticData,
} from '@/lib/firestore-service';
import { CreateNoticeInput, UpdateNoticeInput, NoticeStatus } from '@/types';

/**
 * GET /api/notices
 * List notices with optional status filter and pagination
 */
export async function GET(request: NextRequest) {
  const startTime = process.hrtime.bigint();
  
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as NoticeStatus | null;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    
    const { data, timing } = await listNotices(status || undefined, page, pageSize);
    
    const totalTime = Number(process.hrtime.bigint() - startTime) / 1e6;
    
    return NextResponse.json({
      success: true,
      data,
      timing: {
        ...timing,
        totalMs: totalTime,
      },
    });
  } catch (error) {
    const totalTime = Number(process.hrtime.bigint() - startTime) / 1e6;
    console.error('[API] GET /api/notices error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list notices',
      timing: { applicationMs: 0, networkMs: 0, totalMs: totalTime },
    }, { status: 500 });
  }
}

/**
 * POST /api/notices
 * Create a new notice
 */
export async function POST(request: NextRequest) {
  const startTime = process.hrtime.bigint();
  
  try {
    const body = await request.json();
    
    // Validate required fields
    const { title, content, status, authorId, authorName } = body as CreateNoticeInput;
    
    if (!title || !content || !status || !authorId || !authorName) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: title, content, status, authorId, authorName',
        timing: { applicationMs: 0, networkMs: 0, totalMs: Number(process.hrtime.bigint() - startTime) / 1e6 },
      }, { status: 400 });
    }
    
    if (!['draft', 'published'].includes(status)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid status. Must be "draft" or "published"',
        timing: { applicationMs: 0, networkMs: 0, totalMs: Number(process.hrtime.bigint() - startTime) / 1e6 },
      }, { status: 400 });
    }
    
    const { data, timing } = await createNotice({ title, content, status, authorId, authorName });
    
    const totalTime = Number(process.hrtime.bigint() - startTime) / 1e6;
    
    return NextResponse.json({
      success: true,
      data,
      timing: {
        ...timing,
        totalMs: totalTime,
      },
    }, { status: 201 });
  } catch (error) {
    const totalTime = Number(process.hrtime.bigint() - startTime) / 1e6;
    console.error('[API] POST /api/notices error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create notice',
      timing: { applicationMs: 0, networkMs: 0, totalMs: totalTime },
    }, { status: 500 });
  }
}