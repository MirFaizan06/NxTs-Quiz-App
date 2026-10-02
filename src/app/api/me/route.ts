import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { displayNameFromMetadata } from '@/lib/profile-name';

export async function GET() {
    try {
        const { user, supabase } = await requireUser();
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('id,name,username,role,avatar_url')
            .eq('id', user!.id)
            .single();

        if (error) throw error;

        const metadataName = displayNameFromMetadata(user!.user_metadata);
        if (profile.name === 'Student' && metadataName) {
            const { data: updatedProfile, error: updateError } = await supabase
                .from('profiles')
                .update({ name: metadataName })
                .eq('id', user!.id)
                .eq('name', 'Student')
                .select('id,name,username,role,avatar_url')
                .maybeSingle();

            if (updateError) throw updateError;
            if (updatedProfile) return NextResponse.json(updatedProfile);
        }

        return NextResponse.json(profile);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unauthorized' },
            { status: 401 }
        );
    }
}
