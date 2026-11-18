/**
 * Reviews API Routes
 * Server-side only - uses Firebase Admin SDK
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listReviews,
  listApprovedReviews,
  createReview,
  getReview,
  approveReview,
  hideReview,
  deleteReview,
  seedSyntheticData,
} from '@/lib/firestore-service';
import { CreateReviewInput, ReviewStatus, ModerateReviewInput } from '@/types';

/**
 * GET /api/reviews
 * List reviews with optional status filter and pagination
 * For moderation dashboard - shows all statuses
 */
export async function GET(request: NextRequest) {
  const startTime = process.hrtime.bigint();
  
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ReviewStatus | null;
    const facilityId = searchParams.get('facilityId') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const publicOnly = searchParams.get('public') === 'true';
    
    let data, timing;
    
    if (publicOnly) {
      // Public query - ONLY approved reviews
      const result = await listApprovedReviews(facilityId, page, pageSize);
      data = result.data;
      timing = result.timing;
    } else {
      // Moderation query - all statuses
      const result = await listReviews(status || undefined, facilityId, page, pageSize);
      data = result.data;
      timing = result.timing;
    }
    
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
    console.error('[API] GET /api/reviews error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list reviews',
      timing: { applicationMs: 0, networkMs: 0, totalMs: totalTime },
    }, { status: 500 });
  }
}

/**
 * POST /api/reviews
 * Create a new review (submitted by patients)
 */
export async function POST(request: NextRequest) {
  const startTime = process.hrtime.bigint();
  
  try {
    const body = await request.json();
    
    // Validate required fields
    const { reviewerName, reviewerEmail, rating, comment, facilityId, facilityName } = body as CreateReviewInput;
    
    if (!reviewerName || !reviewerEmail || !rating || !comment || !facilityId || !facilityName) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: reviewerName, reviewerEmail, rating, comment, facilityId, facilityName',
        timing: { applicationMs: 0, networkMs: 0, totalMs: Number(process.hrtime.bigint() - startTime) / 1e6 },
      }, { status: 400 });
    }
    
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json({
        success: false,
        error: 'Rating must be an integer between 1 and 5',
        timing: { applicationMs: 0, networkMs: 0, totalMs: Number(process.hrtime.bigint() - startTime) / 1e6 },
      }, { status: 400 });
    }
    
    // Basic email validation
    if (!reviewerEmail.includes('@')) {
      return NextResponse.json({
        success: false,
        error: 'Invalid email format',
        timing: { applicationMs: 0, networkMs: 0, totalMs: Number(process.hrtime.bigint() - startTime) / 1e6 },
      }, { status: 400 });
    }
    
    const { data, timing } = await createReview({
      reviewerName,
      reviewerEmail,
      rating,
      comment,
      facilityId,
      facilityName,
    });
    
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
    console.error('[API] POST /api/reviews error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create review',
      timing: { applicationMs: 0, networkMs: 0, totalMs: totalTime },
    }, { status: 500 });
  }
}