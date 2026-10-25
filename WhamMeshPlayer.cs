using System;
using System.IO;
using UnityEngine;
using UnityEngine.Rendering;

[RequireComponent(typeof(MeshFilter))]
[RequireComponent(typeof(MeshRenderer))]
public class WhamMeshPlayer : MonoBehaviour
{
    public string resourceName = "climber_motion_route";

    public bool playOnStart = true;
    public bool loop = false;

    public float playbackSpeed = 1f;
    public float modelScale = 1f;

    public Vector3 coordinateScale =
        new Vector3(1f, -1f, 1f);

    private Mesh mesh;

    private int numFrames;
    private int numVertices;
    private int numFaces;

    private float fps;

    private int[] triangles;
    private float[] vertexData;

    private Vector3[] currentVertices;

    private float playbackTime = 0f;
    private bool playing = false;

    public int CurrentFrame { get; private set; }

    void Start()
    {
        LoadMotion();

        playing = playOnStart;
    }

    void Update()
    {
        if (!playing || numFrames == 0)
            return;

        playbackTime +=
            Time.deltaTime * playbackSpeed;

        int frame =
            Mathf.FloorToInt(playbackTime * fps);

        if (loop)
        {
            frame %= numFrames;
        }
        else
        {
            frame = Mathf.Clamp(
                frame,
                0,
                numFrames - 1
            );
        }

        CurrentFrame = frame;

        ShowFrame(frame);
    }

    void LoadMotion()
    {
        TextAsset asset =
            Resources.Load<TextAsset>(resourceName);

        if (asset == null)
        {
            Debug.LogError(
                "Could not find Resources/" +
                resourceName +
                ".bytes"
            );

            return;
        }

        using MemoryStream stream =
            new MemoryStream(asset.bytes);

        using BinaryReader reader =
            new BinaryReader(stream);

        string magic =
            new string(reader.ReadChars(4));

        if (magic != "WHM1")
        {
            Debug.LogError(
                "Invalid WHAM motion file."
            );

            return;
        }

        numFrames = reader.ReadInt32();
        numVertices = reader.ReadInt32();
        numFaces = reader.ReadInt32();
        fps = reader.ReadSingle();

        triangles =
            new int[numFaces * 3];

        for (int i = 0; i < triangles.Length; i++)
        {
            triangles[i] =
                reader.ReadInt32();
        }

        int totalFloats =
            numFrames *
            numVertices *
            3;

        vertexData =
            new float[totalFloats];

        for (int i = 0; i < totalFloats; i++)
        {
            vertexData[i] =
                reader.ReadSingle();
        }

        currentVertices =
            new Vector3[numVertices];

        mesh = new Mesh();

        if (numVertices > 65535)
        {
            mesh.indexFormat =
                IndexFormat.UInt32;
        }

        mesh.name = "WHAM Animated Mesh";
        mesh.MarkDynamic();

        mesh.vertices =
            new Vector3[numVertices];

        mesh.triangles =
            triangles;

        MeshFilter filter =
            GetComponent<MeshFilter>();

        filter.mesh = mesh;

        MeshRenderer renderer =
            GetComponent<MeshRenderer>();

        if (renderer.sharedMaterial == null)
        {
            Shader shader =
                Shader.Find("Standard");

            if (shader != null)
            {
                Material material =
                    new Material(shader);

                material.color =
                    new Color(
                        0.7f,
                        0.7f,
                        0.7f,
                        1f
                    );

                renderer.material =
                    material;
            }
        }

        ShowFrame(0);

        Debug.Log(
            "Loaded WHAM motion: " +
            numFrames +
            " frames, " +
            numVertices +
            " vertices, " +
            fps +
            " FPS"
        );
    }

    void ShowFrame(int frame)
    {
        if (vertexData == null)
            return;

        int start =
            frame *
            numVertices *
            3;

        Vector3 center =
            Vector3.zero;

        // Load the frame exactly like before
        for (int i = 0; i < numVertices; i++)
        {
            int index =
                start + i * 3;

            float x =
                vertexData[index];

            float y =
                vertexData[index + 1];

            float z =
                vertexData[index + 2];

            currentVertices[i] =
                new Vector3(
                    x * coordinateScale.x,
                    y * coordinateScale.y,
                    z * coordinateScale.z
                ) * modelScale;

            center += currentVertices[i];
        }

        // Find the center of the person THIS frame
        center /= numVertices;

        // Turn the BODY 180 degrees around its own center.
        // This does NOT rotate the WHAM route around the scene.
        Quaternion faceWallRotation =
            Quaternion.Euler(0f, 180f, 0f);

        for (int i = 0; i < numVertices; i++)
        {
            Vector3 relative =
                currentVertices[i] - center;

            relative =
                faceWallRotation * relative;

            currentVertices[i] =
                center + relative;
        }

        mesh.vertices =
            currentVertices;

        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
    }
}