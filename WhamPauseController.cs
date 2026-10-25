using UnityEngine;

public class WhamPauseController : MonoBehaviour
{
    public WhamMeshPlayer whamPlayer;

    private bool paused = false;

    void Update()
    {
        // A button on the right Quest controller
        if (OVRInput.GetDown(OVRInput.Button.One))
        {
            paused = !paused;

            if (paused)
            {
                whamPlayer.playbackSpeed = 0f;
                Debug.Log("WHAM paused");
            }
            else
            {
                whamPlayer.playbackSpeed = 1f;
                Debug.Log("WHAM resumed");
            }
        }
    }
}