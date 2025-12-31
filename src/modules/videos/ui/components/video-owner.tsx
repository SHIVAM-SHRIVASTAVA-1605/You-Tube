import Link from "next/link";
import { VideoGetOneOutput } from "../../types";
import { UserAvatar } from "@/components/user-avatar";

interface VideoOwnerProps {
    user: VideoGetOneOutput["user"];
    videoId: string;
};

export const VideoOwner = ({ user, videoId }: VideoOwnerProps) => {
    return (
        <div className="flex items-center sm:items-start justify-between sm:justify-start gap-3 min-w-0">
            <Link href={`/users/${user.id}`}>
                <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar size="lg" imageUrl={user.imageUrl} name={user.name} />
                    <span className="text-sm text-muted-foreground line-clamp-1">
                        {/* TODO: properly fill subscriber count */}
                        {0} subscribers
                    </span>
                </div>
            </Link>
        </div>
    );
};