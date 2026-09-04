const baseUrl = process.env.AI_API_BASE_URL ?? 'http://localhost:3300/api/ai';

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...init
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function main() {
  console.log(`[smoke] baseUrl=${baseUrl}`);

  const story = await request('/story', {
    method: 'POST',
    body: JSON.stringify({ prompt: '一个少年在雨夜遇见神秘女孩' })
  });
  console.log(`[smoke] story title=${story.title}`);

  const storyboard = await request('/storyboard', {
    method: 'POST',
    body: JSON.stringify({ prompt: story.logline })
  });
  console.log(`[smoke] storyboard scenes=${storyboard.scenes?.length ?? 0}`);

  const imageTask = await request('/image', {
    method: 'POST',
    body: JSON.stringify({ prompt: '雨夜角色测试' })
  });
  console.log(`[smoke] image taskId=${imageTask.taskId}`);

  let status = 'PENDING';
  for (let index = 0; index < 8; index += 1) {
    const task = await request(`/tasks/${imageTask.taskId}`, { method: 'GET' });
    status = task.status;
    console.log(`[smoke] poll ${index + 1} status=${status}`);
    if (status === 'SUCCEEDED') {
      const assetName = task.result?.asset?.name ?? 'unknown';
      console.log(`[smoke] success asset=${assetName}`);
      return;
    }

    if (status === 'FAILED') {
      throw new Error(`[smoke] task failed: ${task.error ?? 'unknown error'}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`[smoke] timeout, last status=${status}`);
}

main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
