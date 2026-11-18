/**
 * Individual Notice API Routes
 * GET, PUT, DELETE /api/notices/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getNotice,
  updateNotice,
  deleteNotice,
} from '@/lib/firestore-service';
import { UpdateNoticeInput, NoticeStatus } from '@/types';

/**
 * GET /api/notices/[id]
 * Get a single notice by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = process.hrtime.bigint();
  
  try {
    const { id } = await params;
    
    const { data, timing } = await getNotice(id);
    
    const totalTime = Number(process.hrtime.bigint() - startTime) / 1e6;
    
    if (!data) {
      return NextResponse.json({
        success: false,
        error: 'Notice not found',
        timing: { ...timing, totalMs: totalTime },
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data,
      timing: { ...timing, totalMs: totalTime },
    });
  } catch (error) {
    const totalTime = Number(process.hrtime.bigint() - startTime) / 1e6;
    console.error('[API] GET /api/notices/[id] error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get notice',
      timing: { applicationMs: 0, networkMs: 0, totalMs: totalTime },
    }, { status: 500 });
  }
}

/**
 * PUT /api/notices/[id]
 * Update a notice
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = process.hrtime.bigint();
  
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { title, content, status } = body as UpdateNoticeInput;
    
    // Validate status if provided
    if (status && !['draft', 'published'].includes(status)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid status. Must be "draft" or "published"',
        timing: { applicationMs: 0, networkMs: 0, totalMs: Number(process.hrtime.bigint() - startTime) / 1e6 },
      }, { status: 400 });
    }
    
    const { data, timing } = await updateNotice(id, { title, content, status });
    
    const totalTime = Number(process.hrtime.bigint() - startTime) / 1e6;
    
    if (!data) {
      return NextResponse.json({
        success: false,
        error: 'Notice not found',
        timing: { ...timing, totalMs: totalTime },
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data,
      timing: { ...timing, totalMs: totalTime },
    });
  } catch (error) {
    const totalTime = Number(process.hrtime.bigint() - startTime) / 1e6;
    console.error('[API] PUT /api/notices/[id] error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update notice',
      timing: { applicationMs: 0, networkMs: 0, totalMs: totalTime },
    }, { status: 500 });
  }
}

/**
 * DELETE /api/notices/[id]
 * Delete a notice
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = process.hrtime.bigint();
  
  try {
    const { id } = await params;
    
    const { data, timing } = await deleteNotice(id);
    
    const totalTime = Number(process.hrtime.bigint() - startTime) / 1e6;
    
    return NextResponse.json({
      success: true,
      data,
      timing: { ...timing, totalMs: totalTime },
    });
  } catch (error) {
    const totalTime = Number(process.hrtime.bigint() - startTime) / 1e6;
    console.error('[API] DELETE /api/notices/[id] error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete notice',
      timing: { applicationMs: 0, networkMs: 0, totalMs: totalTime },
    }, { status: 500 });
  }
}