import { Header } from "@/components/header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getTranslations } from "next-intl/server";
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { UserService } from '@/lib/services/user-service';
import { Link } from '@/navigation';

export default async function ProfilePage() {
    const t = await getTranslations('Profile');
    
    // Check if user is authenticated
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    
    if (!token) {
        redirect('/login');
    }
    
    const decoded = UserService.verifyToken(token);
    if (!decoded) {
        redirect('/login');
    }
    
    const user = UserService.getUserById(decoded.userId);
    if (!user) {
        redirect('/login');
    }

    const joinedDate = new Date(user.created_at).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    return (
        <>
            <Header />
            <div className="container mx-auto px-4 py-8">
                <Card className="max-w-4xl mx-auto">
                    <CardHeader className="flex flex-col sm:flex-row items-center gap-6">
                        <Avatar className="h-24 w-24">
                            <AvatarFallback className="text-2xl">
                                {user.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="text-center sm:text-left">
                            <CardTitle className="text-3xl">{user.username}</CardTitle>
                            <CardDescription>{user.email}</CardDescription>
                            <p className="text-sm text-muted-foreground mt-2">{t('joined', { date: joinedDate })}</p>
                            <Button variant="outline" size="sm" className="mt-4" asChild>
                                <Link href="/settings/profile">{t('editProfile')}</Link>
                            </Button>
                        </div>
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-6">
                        {user.bio && (
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold mb-2">Bio</h3>
                                <p className="text-muted-foreground">{user.bio}</p>
                            </div>
                        )}
                        <h3 className="text-lg font-semibold mb-4">{t('statistics')}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div className="p-4 rounded-lg bg-muted">
                                <p className="text-2xl font-bold">0</p>
                                <p className="text-sm text-muted-foreground">{t('animeWatched')}</p>
                            </div>
                            <div className="p-4 rounded-lg bg-muted">
                                <p className="text-2xl font-bold">0</p>
                                <p className="text-sm text-muted-foreground">{t('animeWatching')}</p>
                            </div>
                            <div className="p-4 rounded-lg bg-muted">
                                <p className="text-2xl font-bold">0</p>
                                <p className="text-sm text-muted-foreground">{t('animePlanned')}</p>
                            </div>
                            <div className="p-4 rounded-lg bg-muted">
                                <p className="text-2xl font-bold">-</p>
                                <p className="text-sm text-muted-foreground">{t('meanScore')}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
