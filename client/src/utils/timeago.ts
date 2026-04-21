import { format } from "@astroimg/timeago";

export function timeago(time: string | number | Date) {
    return format(time, "DEFAULT", "zh-CN")
}
