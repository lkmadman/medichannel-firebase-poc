/**
 * Firestore Service Layer
 * Provides typed access to notices and reviews collections
 * Includes timing measurements for performance evaluation
 */

import { getAdminDb } from './firebase-admin';
import {
  Notice,
  CreateNoticeInput,
  UpdateNoticeInput,
  NoticeStatus,
  Review,
  CreateReviewInput,
  ModerateReviewInput,
  ReviewStatus,
  PaginatedResponse,
} from '@/types';
import { Timestamp, Query, DocumentSnapshot, QuerySnapshot } from 'firebase-admin/firestore';

// Collection names
const NOTICES_COLLECTION = 'notices';
const REVIEWS_COLLECTION = 'reviews';

// Timing utility
interface TimingResult {
  applicationMs: number;
  networkMs: number;
  totalMs: number;
}

function measureTiming<T>(fn: () => Promise<T>): Promise<{ result: T; timing: TimingResult }> {
  const appStart = process.hrtime.bigint();
  const networkStart = process.hrtime.bigint();
  
  return fn().then((result) => {
    const networkEnd = process.hrtime.bigint();
    const appEnd = process.hrtime.bigint();
    
    return {
      result,
      timing: {
        applicationMs: Number(appStart - appStart) / 1e6, // This will be 0, we measure differently
        networkMs: Number(networkEnd - networkStart) / 1e6,
        totalMs: Number(appEnd - appStart) / 1e6,
      },
    };
  });
}

// Better timing: wrap the actual Firestore call
async function withTiming<T>(operationName: string, fn: () => Promise<T>): Promise<{ result: T; timing: TimingResult }> {
  const totalStart = process.hrtime.bigint();
  const networkStart = process.hrtime.bigint();
  
  try {
    const result = await fn();
    const networkEnd = process.hrtime.bigint();
    const totalEnd = process.hrtime.bigint();
    
    return {
      result,
      timing: {
        applicationMs: Number(totalEnd - networkEnd) / 1e6,
        networkMs: Number(networkEnd - networkStart) / 1e6,
        totalMs: Number(totalEnd - totalStart) / 1e6,
      },
    };
  } catch (error) {
    const networkEnd = process.hrtime.bigint();
    const totalEnd = process.hrtime.bigint();
    throw {
      error,
      timing: {
        applicationMs: Number(totalEnd - networkEnd) / 1e6,
        networkMs: Number(networkEnd - networkStart) / 1e6,
        totalMs: Number(totalEnd - totalStart) / 1e6,
      },
    };
  }
}

// Helper to convert Firestore timestamps to ISO strings
function convertTimestamps(obj: any): any {
  if (!obj) return obj;
  if (obj instanceof Timestamp) return obj.toDate().toISOString();
  if (Array.isArray(obj)) return obj.map(convertTimestamps);
  if (typeof obj === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertTimestamps(value);
    }
    return converted;
  }
  return obj;
}

// Helper to convert document snapshot to Notice
function docToNotice(doc: DocumentSnapshot): Notice | null {
  if (!doc.exists) return null;
  const data = doc.data()!;
  return {
    id: doc.id,
    ...convertTimestamps(data),
  } as Notice;
}

// Helper to convert document snapshot to Review
function docToReview(doc: DocumentSnapshot): Review | null {
  if (!doc.exists) return null;
  const data = doc.data()!;
  return {
    id: doc.id,
    ...convertTimestamps(data),
  } as Review;
}

/**
 * NOTICES SERVICE
 */

export async function listNotices(
  status?: NoticeStatus,
  page = 1,
  pageSize = 20
): Promise<{ data: PaginatedResponse<Notice>; timing: TimingResult }> {
  return withTiming('listNotices', async () => {
    const db = getAdminDb();
    let query: Query = db.collection(NOTICES_COLLECTION).orderBy('createdAt', 'desc');
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    // Get total count (for pagination info)
    const countSnapshot = await query.count().get();
    const total = countSnapshot.data().count;
    
    // Apply pagination
    const offset = (page - 1) * pageSize;
    const snapshot = await query.limit(pageSize).offset(offset).get();
    
    const items = snapshot.docs.map(docToNotice).filter(Boolean) as Notice[];
    
    return {
      items,
      total,
      page,
      pageSize,
      hasMore: offset + items.length < total,
    };
  });
}

export async function getNotice(id: string): Promise<{ data: Notice | null; timing: TimingResult }> {
  return withTiming('getNotice', async () => {
    const db = getAdminDb();
    const doc = await db.collection(NOTICES_COLLECTION).doc(id).get();
    return docToNotice(doc);
  });
}

export async function createNotice(input: CreateNoticeInput): Promise<{ data: Notice; timing: TimingResult }> {
  return withTiming('createNotice', async () => {
    const db = getAdminDb();
    const now = Timestamp.now();
    
    const noticeData = {
      ...input,
      createdAt: now,
      updatedAt: now,
      publishedAt: input.status === 'published' ? now : null,
    };
    
    const docRef = await db.collection(NOTICES_COLLECTION).add(noticeData);
    const newDoc = await docRef.get();
    
    const notice = docToNotice(newDoc)!;
    return notice;
  });
}

export async function updateNotice(id: string, input: UpdateNoticeInput): Promise<{ data: Notice | null; timing: TimingResult }> {
  return withTiming('updateNotice', async () => {
    const db = getAdminDb();
    const now = Timestamp.now();
    
    const updateData: any = {
      ...input,
      updatedAt: now,
    };
    
    if (input.status === 'published') {
      updateData.publishedAt = now;
    }
    
    await db.collection(NOTICES_COLLECTION).doc(id).update(updateData);
    const doc = await db.collection(NOTICES_COLLECTION).doc(id).get();
    
    return docToNotice(doc);
  });
}

export async function deleteNotice(id: string): Promise<{ data: boolean; timing: TimingResult }> {
  return withTiming('deleteNotice', async () => {
    const db = getAdminDb();
    await db.collection(NOTICES_COLLECTION).doc(id).delete();
    return true;
  });
}

/**
 * REVIEWS SERVICE
 */

export async function listReviews(
  status?: ReviewStatus,
  facilityId?: string,
  page = 1,
  pageSize = 20
): Promise<{ data: PaginatedResponse<Review>; timing: TimingResult }> {
  return withTiming('listReviews', async () => {
    const db = getAdminDb();
    let query: Query = db.collection(REVIEWS_COLLECTION).orderBy('createdAt', 'desc');
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    if (facilityId) {
      query = query.where('facilityId', '==', facilityId);
    }
    
    // Get total count
    const countSnapshot = await query.count().get();
    const total = countSnapshot.data().count;
    
    // Apply pagination
    const offset = (page - 1) * pageSize;
    const snapshot = await query.limit(pageSize).offset(offset).get();
    
    const items = snapshot.docs.map(docToReview).filter(Boolean) as Review[];
    
    return {
      items,
      total,
      page,
      pageSize,
      hasMore: offset + items.length < total,
    };
  });
}

/**
 * Public query - returns ONLY approved reviews
 * This is the publicly visible review query
 */
export async function listApprovedReviews(
  facilityId?: string,
  page = 1,
  pageSize = 20
): Promise<{ data: PaginatedResponse<Review>; timing: TimingResult }> {
  return withTiming('listApprovedReviews', async () => {
    const db = getAdminDb();
    let query: Query = db.collection(REVIEWS_COLLECTION)
      .where('status', '==', 'approved')
      .orderBy('createdAt', 'desc');
    
    if (facilityId) {
      query = query.where('facilityId', '==', facilityId);
    }
    
    const countSnapshot = await query.count().get();
    const total = countSnapshot.data().count;
    
    const offset = (page - 1) * pageSize;
    const snapshot = await query.limit(pageSize).offset(offset).get();
    
    const items = snapshot.docs.map(docToReview).filter(Boolean) as Review[];
    
    return {
      items,
      total,
      page,
      pageSize,
      hasMore: offset + items.length < total,
    };
  });
}

export async function getReview(id: string): Promise<{ data: Review | null; timing: TimingResult }> {
  return withTiming('getReview', async () => {
    const db = getAdminDb();
    const doc = await db.collection(REVIEWS_COLLECTION).doc(id).get();
    return docToReview(doc);
  });
}

export async function createReview(input: CreateReviewInput): Promise<{ data: Review; timing: TimingResult }> {
  return withTiming('createReview', async () => {
    const db = getAdminDb();
    const now = Timestamp.now();
    
    const reviewData = {
      ...input,
      status: 'pending' as ReviewStatus,
      createdAt: now,
      updatedAt: now,
    };
    
    const docRef = await db.collection(REVIEWS_COLLECTION).add(reviewData);
    const newDoc = await docRef.get();
    
    return docToReview(newDoc)!;
  });
}

export async function moderateReview(id: string, input: ModerateReviewInput): Promise<{ data: Review | null; timing: TimingResult }> {
  return withTiming('moderateReview', async () => {
    const db = getAdminDb();
    const now = Timestamp.now();
    
    const updateData = {
      status: input.status,
      updatedAt: now,
      moderatedAt: now,
      moderatedBy: input.moderatedBy,
    };
    
    await db.collection(REVIEWS_COLLECTION).doc(id).update(updateData);
    const doc = await db.collection(REVIEWS_COLLECTION).doc(id).get();
    
    return docToReview(doc);
  });
}

export async function approveReview(id: string, moderatedBy: string): Promise<{ data: Review | null; timing: TimingResult }> {
  return moderateReview(id, { status: 'approved', moderatedBy });
}

export async function hideReview(id: string, moderatedBy: string): Promise<{ data: Review | null; timing: TimingResult }> {
  return moderateReview(id, { status: 'hidden', moderatedBy });
}

export async function deleteReview(id: string): Promise<{ data: boolean; timing: TimingResult }> {
  return withTiming('deleteReview', async () => {
    const db = getAdminDb();
    await db.collection(REVIEWS_COLLECTION).doc(id).delete();
    return true;
  });
}

/**
 * Seed synthetic data for testing
 */
export async function seedSyntheticData(): Promise<{ data: { notices: number; reviews: number }; timing: TimingResult }> {
  return withTiming('seedSyntheticData', async () => {
    const db = getAdminDb();
    const batch = db.batch();
    let noticeCount = 0;
    let reviewCount = 0;
    
    // Seed notices
    const notices: CreateNoticeInput[] = [
      {
        title: 'Welcome to MediChannel',
        content: 'We are excited to launch our new patient feedback platform. Share your experiences and help improve healthcare services.',
        status: 'published',
        authorId: 'admin-001',
        authorName: 'System Administrator',
      },
      {
        title: 'New Appointment Booking Feature',
        content: 'Starting next month, patients can book appointments directly through the portal. This feature will reduce wait times and improve scheduling efficiency.',
        status: 'published',
        authorId: 'admin-001',
        authorName: 'System Administrator',
      },
      {
        title: 'Holiday Hours Update',
        content: 'Please note our modified hours during the holiday season. Emergency services remain available 24/7.',
        status: 'published',
        authorId: 'manager-001',
        authorName: 'Clinic Manager',
      },
      {
        title: 'Draft: Upcoming Policy Changes',
        content: 'This is a draft notice about upcoming policy changes. It will be published after review.',
        status: 'draft',
        authorId: 'manager-001',
        authorName: 'Clinic Manager',
      },
      {
        title: 'Maintenance Notice',
        content: 'Scheduled system maintenance on Sunday 2-4 AM. The portal may be temporarily unavailable.',
        status: 'published',
        authorId: 'admin-001',
        authorName: 'System Administrator',
      },
    ];
    
    for (const notice of notices) {
      const docRef = db.collection(NOTICES_COLLECTION).doc();
      batch.set(docRef, {
        ...notice,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        publishedAt: notice.status === 'published' ? Timestamp.now() : null,
      });
      noticeCount++;
    }
    
    // Seed reviews
    const reviews: CreateReviewInput[] = [
      {
        reviewerName: 'John Smith',
        reviewerEmail: 'john.smith@email.com',
        rating: 5,
        comment: 'Excellent service! The staff was very professional and caring. Dr. Johnson took the time to explain everything clearly.',
        facilityId: 'clinic-001',
        facilityName: 'MediChannel Downtown Clinic',
      },
      {
        reviewerName: 'Sarah Johnson',
        reviewerEmail: 'sarah.j@email.com',
        rating: 4,
        comment: 'Great experience overall. Short wait time and friendly reception. Only minor issue was parking availability.',
        facilityId: 'clinic-001',
        facilityName: 'MediChannel Downtown Clinic',
      },
      {
        reviewerName: 'Michael Brown',
        reviewerEmail: 'm.brown@email.com',
        rating: 3,
        comment: 'Average experience. The doctor was good but the wait time was longer than expected. Front desk could be more organized.',
        facilityId: 'clinic-001',
        facilityName: 'MediChannel Downtown Clinic',
      },
      {
        reviewerName: 'Emily Davis',
        reviewerEmail: 'emily.d@email.com',
        rating: 5,
        comment: 'Outstanding care! The nurses were amazing and made my child feel comfortable. Highly recommend this clinic.',
        facilityId: 'clinic-002',
        facilityName: 'MediChannel Pediatric Center',
      },
      {
        reviewerName: 'Robert Wilson',
        reviewerEmail: 'r.wilson@email.com',
        rating: 2,
        comment: 'Disappointed with the billing process. Received unexpected charges. Medical care was fine but administrative needs improvement.',
        facilityId: 'clinic-001',
        facilityName: 'MediChannel Downtown Clinic',
      },
      {
        reviewerName: 'Lisa Anderson',
        reviewerEmail: 'l.anderson@email.com',
        rating: 4,
        comment: 'Very clean facility and modern equipment. The online check-in saved a lot of time. Will return.',
        facilityId: 'clinic-002',
        facilityName: 'MediChannel Pediatric Center',
      },
      {
        reviewerName: 'David Martinez',
        reviewerEmail: 'd.martinez@email.com',
        rating: 1,
        comment: 'Terrible experience. Rude staff and misdiagnosis. Would not recommend to anyone.',
        facilityId: 'clinic-001',
        facilityName: 'MediChannel Downtown Clinic',
      },
      {
        reviewerName: 'Jennifer Taylor',
        reviewerEmail: 'j.taylor@email.com',
        rating: 5,
        comment: 'Best healthcare experience I have had in years. Dr. Williams is exceptional. The whole team is professional.',
        facilityId: 'clinic-003',
        facilityName: 'MediChannel Specialty Care',
      },
    ];
    
    // Assign statuses: some approved, some pending, some hidden
    const reviewStatuses: ReviewStatus[] = ['approved', 'approved', 'pending', 'approved', 'hidden', 'approved', 'pending', 'approved'];
    
    for (let i = 0; i < reviews.length; i++) {
      const docRef = db.collection(REVIEWS_COLLECTION).doc();
      batch.set(docRef, {
        ...reviews[i],
        status: reviewStatuses[i],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        moderatedAt: reviewStatuses[i] !== 'pending' ? Timestamp.now() : null,
        moderatedBy: reviewStatuses[i] !== 'pending' ? 'moderator-001' : null,
      });
      reviewCount++;
    }
    
    await batch.commit();
    
    return { notices: noticeCount, reviews: reviewCount };
  });
}