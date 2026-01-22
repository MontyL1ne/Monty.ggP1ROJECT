// postsApi.js — работа с серверным API постов и загрузкой изображений

// Загрузка всех постов
export async function apiGetPosts() {
    try {
        const resp = await fetch("/api/posts");
        if (!resp.ok) {
            console.error("Ошибка загрузки постов с сервера", resp.status);
            return [];
        }
        return await resp.json();
    } catch (err) {
        console.error("Ошибка сети при загрузке постов", err);
        return [];
    }
}

// Создание поста
export async function apiCreatePost(dto) {
    try {
        const resp = await fetch("/api/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dto)
        });

        if (!resp.ok) {
            const text = await resp.text().catch(() => "");
            console.error("Ошибка создания поста (код " + resp.status + "):", text);
            return null;
        }

        return await resp.json();
    } catch (err) {
        console.error("Ошибка сети при создании поста", err);
        return null;
    }
}

// Обновление поста
export async function apiUpdatePost(id, dto) {
    try {
        const resp = await fetch(`/api/posts/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dto)
        });

        if (!resp.ok) {
            const text = await resp.text().catch(() => "");
            console.error("Ошибка обновления поста (код " + resp.status + "):", text);
            return null;
        }

        return await resp.json();
    } catch (err) {
        console.error("Ошибка сети при обновлении поста", err);
        return null;
    }
}

// Удаление поста
export async function apiDeletePost(id) {
    try {
        const resp = await fetch(`/api/posts/${id}`, { method: "DELETE" });
        if (!resp.ok) {
            const text = await resp.text().catch(() => "");
            console.error("Ошибка удаления поста (код " + resp.status + "):", text);
            return false;
        }
        return true;
    } catch (err) {
        console.error("Ошибка сети при удалении поста", err);
        return false;
    }
}

// Загрузка изображений на сервер (возвращает массив URL'ов)
export async function uploadImagesToServer(files) {
    if (!files || files.length === 0) return [];

    const formData = new FormData();
    for (const file of files) {
        formData.append("anyname", file);
    }

    const resp = await fetch("/api/uploads", {
        method: "POST",
        body: formData
    });

    const text = await resp.text().catch(() => "");

    if (!resp.ok) {
        console.error("Ошибка загрузки изображений (код " + resp.status + "):", text);
        throw new Error("Upload failed");
    }

    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.error("Upload: невалидный JSON", e, text);
        throw new Error("Upload failed: bad JSON");
    }

    if (!Array.isArray(data)) {
        console.error("Upload: ожидался массив URL, а пришло", data);
        throw new Error("Upload failed: wrong format");
    }

    return data;
}
